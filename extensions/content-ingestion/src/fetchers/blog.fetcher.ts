/**
 * BlogFetcher
 *
 * Fetches a web page and extracts its main article content using native fetch().
 * Targets common HTML article selectors used by major blogging platforms
 * and CMS frameworks (WordPress, Ghost, Medium, etc.).
 *
 * Returns a single-item array since each URL represents one article.
 * Returns empty array on any failure (network error, non-200, timeout).
 */

import type { FetchedItem } from './rss.fetcher';

export class BlogFetcher {
  /**
   * Fetch a blog/article page and extract its title and main content.
   *
   * Extraction strategy:
   *   1. Fetch the HTML with a browser-like User-Agent
   *   2. Extract <title> tag for the article title
   *   3. Extract content from common article selectors in priority order:
   *      article, [role="main"], .post-content, .entry-content, .article-body,
   *      .content, main, .container (as fallback)
   *   4. Strip HTML tags and normalize whitespace to produce plain text
   *   5. Extract og:image for the representative image
   *
   * The externalId is a stable hash of the URL to allow upsert deduplication.
   *
   * @param url - The full blog/article page URL to fetch
   * @returns Single-item array with extracted article data, or empty array on failure
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
        console.warn(`[BlogFetcher] HTTP ${response.status} for ${url}`);
        return [];
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('text/html') && !contentType.includes('xhtml')) {
        console.warn(`[BlogFetcher] Non-HTML content-type '${contentType}' for ${url}`);
        return [];
      }

      const html = await response.text();
      const item = this.extractArticle(html, url);

      return item ? [item] : [];
    } catch (err: any) {
      console.warn(`[BlogFetcher] Failed to fetch ${url}: ${err?.message}`);
      return [];
    }
  }

  /**
   * Extract article data from raw HTML.
   *
   * @param html - Full HTML page string
   * @param url - Source URL (used as externalId base and fallback link)
   * @returns FetchedItem or null if extraction yields no meaningful content
   */
  private extractArticle(html: string, url: string): FetchedItem | null {
    const title = this.extractTitle(html);
    const content = this.extractMainContent(html);
    const imageUrl = this.extractOgImage(html) || this.extractFirstImage(html);
    const externalId = this.hashUrl(url);

    if (!content || content.length < 20) {
      return null;
    }

    return {
      externalId,
      title: title || new URL(url).pathname,
      content: this.truncateContent(content, 5000),
      url,
      imageUrl: imageUrl || undefined,
    };
  }

  /**
   * Extract page title from <title> tag or og:title meta tag.
   *
   * Prefers og:title for cleaner article titles (avoids "Article | Site Name"
   * patterns that are common in <title> tags).
   *
   * @param html - Full HTML string
   * @returns Title string, or empty string if not found
   */
  private extractTitle(html: string): string {
    // Try og:title first (cleaner for articles)
    const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    if (ogMatch) return this.decodeEntities(ogMatch[1].trim());

    // Fall back to <title>
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) return this.decodeEntities(titleMatch[1].trim());

    return '';
  }

  /**
   * Extract main content from common article selectors.
   *
   * Tries selectors in priority order, stopping at the first match that
   * has sufficient text content (>50 chars after stripping tags).
   *
   * Priority order:
   *   1. <article> — semantic HTML5 article element
   *   2. [role="main"] — ARIA landmark
   *   3. .post-content / .post-body — WordPress/Ghost
   *   4. .entry-content / .entry-body — WordPress
   *   5. .article-body / .article-content — news sites
   *   6. .blog-content / .blog-post — blog platforms
   *   7. <main> — HTML5 main element
   *   8. .content — generic content wrapper
   *
   * @param html - Full HTML string
   * @returns Extracted plain text content, or empty string if none found
   */
  private extractMainContent(html: string): string {
    // Remove script and style blocks first to prevent their content from
    // polluting the extracted text
    const cleaned = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Selectors in priority order — each is a simple string match
    const selectors: Array<{ tag: string; attr?: string; attrValue?: string }> = [
      { tag: 'article' },
      { tag: 'div', attr: 'role', attrValue: 'main' },
      { tag: 'main' },
      { tag: 'div', attr: 'class', attrValue: 'post-content' },
      { tag: 'div', attr: 'class', attrValue: 'post-body' },
      { tag: 'div', attr: 'class', attrValue: 'entry-content' },
      { tag: 'div', attr: 'class', attrValue: 'entry-body' },
      { tag: 'div', attr: 'class', attrValue: 'article-body' },
      { tag: 'div', attr: 'class', attrValue: 'article-content' },
      { tag: 'div', attr: 'class', attrValue: 'blog-content' },
      { tag: 'div', attr: 'class', attrValue: 'blog-post' },
      { tag: 'div', attr: 'class', attrValue: 'content' },
    ];

    for (const selector of selectors) {
      const block = this.extractElementBlock(cleaned, selector.tag, selector.attr, selector.attrValue);
      if (block) {
        const text = this.stripHtml(block);
        if (text.length > 50) {
          return text;
        }
      }
    }

    // Last resort: strip the entire <body> tag
    const bodyBlock = this.extractElementBlock(cleaned, 'body');
    if (bodyBlock) {
      return this.stripHtml(bodyBlock);
    }

    return this.stripHtml(cleaned);
  }

  /**
   * Extract an HTML element block by tag and optional attribute filter.
   *
   * For class matching: checks if the class attribute CONTAINS the given value
   * (partial match, e.g. "post-content" matches "post-content flex container").
   *
   * @param html - HTML string to search
   * @param tag - HTML tag name (e.g. 'article', 'div', 'main')
   * @param attr - Optional attribute to filter on (e.g. 'class', 'role')
   * @param attrValue - Required value for the attribute (partial match for class)
   * @returns Inner HTML of the matched element, or empty string
   */
  private extractElementBlock(
    html: string,
    tag: string,
    attr?: string,
    attrValue?: string,
  ): string {
    const tagPattern = attr
      ? new RegExp(`<${tag}[^>]+${attr}=["'][^"']*${attrValue}[^"']*["'][^>]*>`, 'i')
      : new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'i');

    const match = html.match(tagPattern);
    if (!match) return '';

    const start = html.indexOf(match[0]);
    if (start === -1) return '';

    // Walk forward to find the matching closing tag (handling nesting)
    const openTag = `<${tag}`;
    const closeTag = `</${tag}>`;
    let depth = 1;
    let pos = start + match[0].length;

    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf(openTag, pos);
      const nextClose = html.indexOf(closeTag, pos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + openTag.length;
      } else {
        depth--;
        if (depth === 0) {
          return html.substring(start + match[0].length, nextClose);
        }
        pos = nextClose + closeTag.length;
      }
    }

    return '';
  }

  /**
   * Extract og:image meta tag content for use as the article's representative image.
   *
   * @param html - Full HTML string
   * @returns Image URL string, or empty string if not found
   */
  private extractOgImage(html: string): string {
    const match = html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    );
    if (match) return match[1].trim();

    // Also try reversed attribute order
    const reverseMatch = html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    );
    return reverseMatch ? reverseMatch[1].trim() : '';
  }

  /**
   * Extract the src of the first <img> tag in the HTML as a fallback image.
   *
   * @param html - HTML string to search
   * @returns Image src URL string, or empty string if not found
   */
  private extractFirstImage(html: string): string {
    const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : '';
  }

  /**
   * Strip all HTML tags and normalize whitespace to produce plain text.
   *
   * @param html - HTML string to convert to plain text
   * @returns Plain text with tags stripped and whitespace collapsed
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Decode common HTML entities in a string (for title fields).
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
   * Truncate content to a maximum character length, breaking at word boundary.
   *
   * Prevents excessively large content from being stored in the DB.
   *
   * @param content - Plain text content to truncate
   * @param maxLength - Maximum character length (default 5000)
   * @returns Truncated content string
   */
  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) return content;
    const truncated = content.substring(0, maxLength);
    // Break at the last space to avoid cutting mid-word
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > maxLength * 0.8 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
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
