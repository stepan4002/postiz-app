/**
 * ProductFetcher
 *
 * Fetches a product page and extracts product information using native fetch().
 * Focuses on Open Graph and product-specific meta tags which are widely used
 * by e-commerce platforms (Shopify, WooCommerce, BigCommerce, etc.).
 *
 * Returns a single-item array since each URL represents one product.
 * Returns empty array on any failure (network error, non-200, timeout, etc.).
 */

import type { FetchedItem } from './rss.fetcher';

export class ProductFetcher {
  /**
   * Fetch a product page and extract product name, description, image, and price.
   *
   * Extraction strategy (priority order for each field):
   *
   * Title:
   *   1. og:title (most reliable for product names)
   *   2. product:name (Schema.org / product meta)
   *   3. <title> tag (fallback)
   *
   * Description:
   *   1. og:description
   *   2. product:description
   *   3. meta name="description"
   *   4. Schema.org JSON-LD "description" field
   *
   * Image:
   *   1. og:image
   *   2. product:image
   *
   * Price:
   *   1. product:price:amount + product:price:currency
   *   2. og:price:amount + og:price:currency
   *   3. Schema.org JSON-LD "price" + "priceCurrency"
   *
   * Content is assembled as: "Product: {title}\n\n{description}\n\nPrice: {price}"
   *
   * @param url - The full product page URL to fetch
   * @returns Single-item array with product data, or empty array on failure
   */
  async fetch(url: string): Promise<FetchedItem[]> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; Postiz-ContentIngestion/1.0; +https://postiz.com)',
          Accept: 'text/html,application/xhtml+xml,*/*',
        },
        signal: AbortSignal.timeout(15_000),
        redirect: 'follow',
      });

      if (!response.ok) {
        console.warn(`[ProductFetcher] HTTP ${response.status} for ${url}`);
        return [];
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
        console.warn(`[ProductFetcher] Non-HTML content-type for ${url}`);
        return [];
      }

      const html = await response.text();
      const item = this.extractProduct(html, url);

      return item ? [item] : [];
    } catch (err: any) {
      console.warn(`[ProductFetcher] Failed to fetch ${url}: ${err?.message}`);
      return [];
    }
  }

  /**
   * Extract structured product data from raw HTML.
   *
   * @param html - Full HTML page string
   * @param url - Source URL (used as externalId base)
   * @returns FetchedItem or null if no meaningful product data found
   */
  private extractProduct(html: string, url: string): FetchedItem | null {
    const title = this.extractProductTitle(html);
    const description = this.extractProductDescription(html);
    const imageUrl = this.extractProductImage(html);
    const price = this.extractProductPrice(html);

    if (!title && !description) {
      return null;
    }

    // Build structured content string for use in post generation
    const contentParts: string[] = [];
    if (title) contentParts.push(`Product: ${title}`);
    if (description) contentParts.push(description);
    if (price) contentParts.push(`Price: ${price}`);
    const content = contentParts.join('\n\n');

    const externalId = this.hashUrl(url);

    return {
      externalId,
      title: title || new URL(url).pathname,
      content,
      url,
      imageUrl: imageUrl || undefined,
    };
  }

  /**
   * Extract product name from meta tags.
   *
   * Priority:
   *   1. og:title — most commonly set to the product name
   *   2. meta name="product:name" — explicit product meta
   *   3. <title> tag — last resort (may include site name suffix)
   *
   * @param html - Full HTML string
   * @returns Product name string, or empty string if not found
   */
  private extractProductTitle(html: string): string {
    return (
      this.extractMetaProperty(html, 'og:title') ||
      this.extractMetaName(html, 'product:name') ||
      this.extractTitleTag(html)
    );
  }

  /**
   * Extract product description from meta tags and JSON-LD.
   *
   * Priority:
   *   1. og:description
   *   2. meta name="product:description"
   *   3. meta name="description" (generic page description)
   *   4. Schema.org JSON-LD "description" field
   *
   * @param html - Full HTML string
   * @returns Description string, or empty string if not found
   */
  private extractProductDescription(html: string): string {
    return (
      this.extractMetaProperty(html, 'og:description') ||
      this.extractMetaName(html, 'product:description') ||
      this.extractMetaName(html, 'description') ||
      this.extractJsonLdField(html, 'description')
    );
  }

  /**
   * Extract product image URL from meta tags.
   *
   * Priority:
   *   1. og:image — standard Open Graph image
   *   2. meta property="product:image" — explicit product image
   *
   * @param html - Full HTML string
   * @returns Image URL string, or empty string if not found
   */
  private extractProductImage(html: string): string {
    return (
      this.extractMetaProperty(html, 'og:image') ||
      this.extractMetaProperty(html, 'product:image')
    );
  }

  /**
   * Extract product price from meta tags and JSON-LD.
   *
   * Attempts to combine amount and currency into a formatted string.
   *
   * Priority:
   *   1. product:price:amount + product:price:currency (Facebook product catalog)
   *   2. og:price:amount + og:price:currency (older Open Graph extension)
   *   3. Schema.org JSON-LD price + priceCurrency
   *
   * @param html - Full HTML string
   * @returns Formatted price string (e.g. "29.99 USD"), or empty string if not found
   */
  private extractProductPrice(html: string): string {
    // product:price:amount / product:price:currency (Facebook catalog format)
    const productAmount = this.extractMetaProperty(html, 'product:price:amount');
    const productCurrency = this.extractMetaProperty(html, 'product:price:currency');
    if (productAmount) {
      return productCurrency ? `${productAmount} ${productCurrency}` : productAmount;
    }

    // og:price:amount / og:price:currency (Open Graph extension)
    const ogAmount = this.extractMetaProperty(html, 'og:price:amount');
    const ogCurrency = this.extractMetaProperty(html, 'og:price:currency');
    if (ogAmount) {
      return ogCurrency ? `${ogAmount} ${ogCurrency}` : ogAmount;
    }

    // Schema.org JSON-LD: look for "price" and "priceCurrency"
    const jsonPrice = this.extractJsonLdField(html, 'price');
    const jsonCurrency = this.extractJsonLdField(html, 'priceCurrency');
    if (jsonPrice) {
      return jsonCurrency ? `${jsonPrice} ${jsonCurrency}` : jsonPrice;
    }

    return '';
  }

  /**
   * Extract a meta property value from og: or other property-based meta tags.
   *
   * Handles both attribute orderings:
   *   <meta property="og:title" content="..." />
   *   <meta content="..." property="og:title" />
   *
   * @param html - Full HTML string
   * @param property - Property name to look up (e.g. 'og:title', 'og:image')
   * @returns Content attribute value, or empty string if not found
   */
  private extractMetaProperty(html: string, property: string): string {
    // property="..." content="..."
    const match1 = html.match(
      new RegExp(
        `<meta[^>]+property=["']${this.escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
        'i',
      ),
    );
    if (match1) return this.decodeEntities(match1[1].trim());

    // content="..." property="..."
    const match2 = html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${this.escapeRegex(property)}["']`,
        'i',
      ),
    );
    return match2 ? this.decodeEntities(match2[1].trim()) : '';
  }

  /**
   * Extract a meta name value (name="..." content="...").
   *
   * Handles both attribute orderings.
   *
   * @param html - Full HTML string
   * @param name - Meta name to look up (e.g. 'description', 'product:name')
   * @returns Content attribute value, or empty string if not found
   */
  private extractMetaName(html: string, name: string): string {
    // name="..." content="..."
    const match1 = html.match(
      new RegExp(
        `<meta[^>]+name=["']${this.escapeRegex(name)}["'][^>]+content=["']([^"']+)["']`,
        'i',
      ),
    );
    if (match1) return this.decodeEntities(match1[1].trim());

    // content="..." name="..."
    const match2 = html.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${this.escapeRegex(name)}["']`,
        'i',
      ),
    );
    return match2 ? this.decodeEntities(match2[1].trim()) : '';
  }

  /**
   * Extract the page <title> tag content.
   *
   * @param html - Full HTML string
   * @returns Title text, or empty string if not found
   */
  private extractTitleTag(html: string): string {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? this.decodeEntities(match[1].trim()) : '';
  }

  /**
   * Extract a field value from Schema.org JSON-LD <script type="application/ld+json"> blocks.
   *
   * Parses the first JSON-LD block found and looks for the given field at the top level
   * of the JSON object. Handles both Product type and generic objects.
   *
   * @param html - Full HTML string
   * @param field - JSON field name to extract (e.g. 'description', 'price')
   * @returns Field value as string, or empty string if not found or parse fails
   */
  private extractJsonLdField(html: string, field: string): string {
    const jsonLdMatch = html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
    );
    if (!jsonLdMatch) return '';

    try {
      const parsed = JSON.parse(jsonLdMatch[1]);
      const value = parsed[field];
      if (value === undefined || value === null) return '';
      return String(value).trim();
    } catch {
      return '';
    }
  }

  /**
   * Decode common HTML entities in a string.
   *
   * @param text - Text that may contain HTML entities
   * @returns Decoded text
   */
  private decodeEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  /**
   * Escape special regex characters in a string for use in RegExp constructor.
   *
   * @param str - String to escape
   * @returns Regex-safe escaped string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Generate a stable hash of a URL to use as externalId.
   *
   * Uses a simple djb2-style hash producing a hex string.
   * Deterministic: same URL always produces the same ID.
   *
   * @param url - URL string to hash
   * @returns 8-character hex hash string
   */
  private hashUrl(url: string): string {
    let hash = 5381;
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) + hash) ^ url.charCodeAt(i);
      hash = hash >>> 0; // Convert to unsigned 32-bit int
    }
    return hash.toString(16).padStart(8, '0');
  }
}
