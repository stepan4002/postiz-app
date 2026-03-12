/**
 * RssFetcher
 *
 * Fetches and parses RSS 2.0 and Atom 1.0 feeds using native fetch().
 * Parses XML via targeted regex extraction to avoid external XML library
 * dependencies, consistent with the project's lightweight approach.
 *
 * Handles both RSS <item> elements and Atom <entry> elements.
 * Returns empty array on any error (network failure, malformed XML, etc.)
 * to ensure one broken source never affects the cron cycle.
 */

export interface FetchedItem {
  externalId: string;
  title: string;
  content: string;
  url: string;
  imageUrl?: string;
}

export class RssFetcher {
  /**
   * Fetch and parse an RSS or Atom feed URL.
   *
   * Parsing strategy:
   * - Detect format by presence of <item> (RSS) or <entry> (Atom) tags
   * - Extract per-entry fields using substring-based regex matches
   * - Strip CDATA wrappers and HTML tags from content fields
   * - Use <link> or <guid> as the canonical externalId
   *
   * @param url - The full RSS/Atom feed URL to fetch
   * @returns Array of FetchedItem objects (empty on any failure)
   */
  async fetch(url: string): Promise<FetchedItem[]> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Postiz-ContentIngestion/1.0 (RSS reader)',
          Accept: 'application/rss+xml, application/atom+xml, text/xml, */*',
        },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        console.warn(`[RssFetcher] HTTP ${response.status} for ${url}`);
        return [];
      }

      const xml = await response.text();
      return this.parseXml(xml, url);
    } catch (err: any) {
      console.warn(`[RssFetcher] Failed to fetch ${url}: ${err?.message}`);
      return [];
    }
  }

  /**
   * Parse XML string into FetchedItem array.
   *
   * Detects RSS 2.0 (<item>) vs Atom 1.0 (<entry>) by tag presence.
   *
   * @param xml - Raw XML string from the feed response
   * @param feedUrl - Original feed URL (used as fallback ID context)
   * @returns Parsed FetchedItem array
   */
  private parseXml(xml: string, feedUrl: string): FetchedItem[] {
    const isAtom = xml.includes('<entry');
    const entryTag = isAtom ? 'entry' : 'item';

    const entries = this.extractBlocks(xml, entryTag);
    const items: FetchedItem[] = [];

    for (const block of entries) {
      try {
        const item = isAtom
          ? this.parseAtomEntry(block, feedUrl)
          : this.parseRssItem(block, feedUrl);

        if (item) {
          items.push(item);
        }
      } catch {
        // Skip malformed individual entries — continue with remaining
      }
    }

    return items;
  }

  /**
   * Extract all text blocks delimited by the given XML tag.
   *
   * @param xml - Full XML string
   * @param tag - Tag name to extract blocks for (e.g. 'item', 'entry')
   * @returns Array of inner-text blocks between open and close tags
   */
  private extractBlocks(xml: string, tag: string): string[] {
    const blocks: string[] = [];
    const openTag = `<${tag}`;
    const closeTag = `</${tag}>`;
    let searchFrom = 0;

    while (true) {
      const start = xml.indexOf(openTag, searchFrom);
      if (start === -1) break;

      const end = xml.indexOf(closeTag, start);
      if (end === -1) break;

      blocks.push(xml.substring(start, end + closeTag.length));
      searchFrom = end + closeTag.length;
    }

    return blocks;
  }

  /**
   * Parse a single RSS 2.0 <item> block into a FetchedItem.
   *
   * Field mapping:
   *   title       <- <title>
   *   url         <- <link>
   *   externalId  <- <guid> fallback <link>
   *   content     <- <content:encoded> fallback <description>
   *   imageUrl    <- <media:thumbnail url="..."> or <enclosure url="...">
   *
   * @param block - Raw XML block for a single <item>
   * @param feedUrl - Parent feed URL for context in error messages
   * @returns Parsed FetchedItem or null if required fields are missing
   */
  private parseRssItem(block: string, feedUrl: string): FetchedItem | null {
    const title = this.extractTag(block, 'title');
    const link = this.extractTag(block, 'link') || this.extractAtomLink(block);
    const guid = this.extractTag(block, 'guid') || link;
    const contentEncoded = this.extractTag(block, 'content:encoded');
    const description = this.extractTag(block, 'description');
    const content = contentEncoded || description || '';
    const imageUrl =
      this.extractAttrFromTag(block, 'media:thumbnail', 'url') ||
      this.extractAttrFromTag(block, 'enclosure', 'url') ||
      this.extractFirstImageSrc(content);

    if (!guid && !link) {
      return null;
    }

    const externalId = this.normalizeId(guid || link || feedUrl);

    return {
      externalId,
      title: this.cleanText(title || 'Untitled'),
      content: this.stripHtml(content),
      url: link || feedUrl,
      imageUrl: imageUrl || undefined,
    };
  }

  /**
   * Parse a single Atom 1.0 <entry> block into a FetchedItem.
   *
   * Field mapping:
   *   title       <- <title>
   *   url         <- <link rel="alternate" href="..."> or <link href="...">
   *   externalId  <- <id>
   *   content     <- <content> fallback <summary>
   *   imageUrl    <- first <img src="..."> found in content
   *
   * @param block - Raw XML block for a single <entry>
   * @param feedUrl - Parent feed URL for context in error messages
   * @returns Parsed FetchedItem or null if required fields are missing
   */
  private parseAtomEntry(block: string, feedUrl: string): FetchedItem | null {
    const title = this.extractTag(block, 'title');
    const id = this.extractTag(block, 'id');
    const link =
      this.extractAtomLink(block) || this.extractAttrFromTag(block, 'link', 'href');
    const content =
      this.extractTag(block, 'content') || this.extractTag(block, 'summary') || '';
    const imageUrl = this.extractFirstImageSrc(content);

    if (!id && !link) {
      return null;
    }

    const externalId = this.normalizeId(id || link || feedUrl);

    return {
      externalId,
      title: this.cleanText(title || 'Untitled'),
      content: this.stripHtml(content),
      url: link || feedUrl,
      imageUrl: imageUrl || undefined,
    };
  }

  /**
   * Extract the text content between an XML tag pair.
   *
   * Handles CDATA sections: <tag><![CDATA[...]]></tag>
   *
   * @param xml - XML string to search in
   * @param tag - Tag name (without angle brackets)
   * @returns Extracted text, or empty string if not found
   */
  private extractTag(xml: string, tag: string): string {
    const open = `<${tag}`;
    const close = `</${tag}>`;

    const start = xml.indexOf(open);
    if (start === -1) return '';

    // Find the end of the opening tag (may have attributes)
    const tagEnd = xml.indexOf('>', start);
    if (tagEnd === -1) return '';

    const end = xml.indexOf(close, tagEnd);
    if (end === -1) return '';

    let inner = xml.substring(tagEnd + 1, end).trim();

    // Strip CDATA wrapper
    if (inner.startsWith('<![CDATA[') && inner.endsWith(']]>')) {
      inner = inner.slice(9, -3);
    }

    return inner;
  }

  /**
   * Extract an attribute value from a self-closing or opening XML tag.
   *
   * Example: extractAttrFromTag(xml, 'enclosure', 'url') finds
   * <enclosure url="https://..." /> and returns the URL value.
   *
   * @param xml - XML string to search in
   * @param tag - Tag name to locate
   * @param attr - Attribute name whose value to extract
   * @returns Attribute value string, or empty string if not found
   */
  private extractAttrFromTag(xml: string, tag: string, attr: string): string {
    const tagStart = xml.indexOf(`<${tag}`);
    if (tagStart === -1) return '';

    const tagEnd = xml.indexOf('>', tagStart);
    if (tagEnd === -1) return '';

    const tagContent = xml.substring(tagStart, tagEnd + 1);

    // Match attr="value" or attr='value'
    const attrRegex = new RegExp(`${attr}=["']([^"']+)["']`);
    const match = tagContent.match(attrRegex);
    return match ? match[1] : '';
  }

  /**
   * Extract href from Atom <link> elements.
   *
   * Atom uses <link href="..." rel="alternate"/> rather than text content.
   * Prefers rel="alternate" if present, otherwise any link with href.
   *
   * @param xml - XML block to search in
   * @returns URL string, or empty string if not found
   */
  private extractAtomLink(xml: string): string {
    // Try rel="alternate" first
    const alternateMatch = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/);
    if (alternateMatch) return alternateMatch[1];

    // Try href="..." on any <link> tag
    const hrefMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/);
    if (hrefMatch) return hrefMatch[1];

    return '';
  }

  /**
   * Extract the src attribute from the first <img> tag found in an HTML string.
   *
   * Used as a fallback image extractor from content/description fields.
   *
   * @param html - HTML content string to search
   * @returns Image src URL string, or empty string if no image found
   */
  private extractFirstImageSrc(html: string): string {
    const match = html.match(/<img[^>]*src=["']([^"']+)["']/i);
    return match ? match[1] : '';
  }

  /**
   * Strip all HTML tags from a string and normalize whitespace.
   *
   * Used to convert HTML content/descriptions to plain text suitable
   * for use as source item content in the ingestion pipeline.
   *
   * @param html - HTML string to strip
   * @returns Plain text with tags removed and whitespace normalized
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
   * Clean text by stripping HTML entities and normalizing whitespace.
   *
   * Lighter version of stripHtml for use on title fields that rarely
   * contain HTML tags but may contain entities.
   *
   * @param text - Text to clean
   * @returns Cleaned text
   */
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalize a raw ID string to a stable, consistent format.
   *
   * Trims whitespace and truncates to 512 characters to fit DB column limits.
   * URIs, GUIDs, and URLs all pass through unchanged (beyond trimming).
   *
   * @param raw - Raw ID string (URI, GUID, URL, etc.)
   * @returns Normalized ID string
   */
  private normalizeId(raw: string): string {
    return raw.trim().substring(0, 512);
  }
}
