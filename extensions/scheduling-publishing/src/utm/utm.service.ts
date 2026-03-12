import { Injectable } from '@nestjs/common';

/**
 * UTMService — Appends UTM tracking parameters to URLs in post content.
 *
 * Company-level UTM template: { source: "{platform}", medium: "social", campaign: "{company}-{date}" }
 * Before publishing, scans post content for URLs and appends UTM params.
 */
@Injectable()
export class UTMService {
  /**
   * Apply UTM parameters to all URLs found in the content string.
   * Skips URLs that already have UTM params.
   */
  applyUTMToContent(
    content: string,
    utmTemplate: UTMTemplate,
    context: UTMContext,
  ): string {
    if (!content || !utmTemplate) return content;

    // URL regex that matches http/https URLs
    const urlRegex = /(https?:\/\/[^\s<>"')\]]+)/gi;

    return content.replace(urlRegex, (url) => {
      try {
        const parsed = new URL(url);
        // Skip if already has UTM params
        if (parsed.searchParams.has('utm_source')) return url;

        const resolved = this.resolveTemplate(utmTemplate, context);
        if (resolved.source) parsed.searchParams.set('utm_source', resolved.source);
        if (resolved.medium) parsed.searchParams.set('utm_medium', resolved.medium);
        if (resolved.campaign) parsed.searchParams.set('utm_campaign', resolved.campaign);
        if (resolved.term) parsed.searchParams.set('utm_term', resolved.term);
        if (resolved.content) parsed.searchParams.set('utm_content', resolved.content);

        return parsed.toString();
      } catch {
        return url; // Skip invalid URLs
      }
    });
  }

  /**
   * Parse a content string and return all URLs found.
   */
  extractUrls(content: string): string[] {
    if (!content) return [];
    const urlRegex = /(https?:\/\/[^\s<>"')\]]+)/gi;
    return content.match(urlRegex) || [];
  }

  /**
   * Preview what URLs would look like with UTM params applied.
   */
  previewUTMUrls(
    content: string,
    utmTemplate: UTMTemplate,
    context: UTMContext,
  ): Array<{ original: string; tagged: string }> {
    const urls = this.extractUrls(content);
    const resolved = this.resolveTemplate(utmTemplate, context);

    return urls.map((url) => {
      try {
        const parsed = new URL(url);
        if (parsed.searchParams.has('utm_source')) {
          return { original: url, tagged: url };
        }
        if (resolved.source) parsed.searchParams.set('utm_source', resolved.source);
        if (resolved.medium) parsed.searchParams.set('utm_medium', resolved.medium);
        if (resolved.campaign) parsed.searchParams.set('utm_campaign', resolved.campaign);
        if (resolved.term) parsed.searchParams.set('utm_term', resolved.term);
        if (resolved.content) parsed.searchParams.set('utm_content', resolved.content);
        return { original: url, tagged: parsed.toString() };
      } catch {
        return { original: url, tagged: url };
      }
    });
  }

  private resolveTemplate(template: UTMTemplate, context: UTMContext): UTMTemplate {
    const resolve = (value?: string) => {
      if (!value) return undefined;
      return value
        .replace('{platform}', context.platform || '')
        .replace('{company}', context.companyName || '')
        .replace('{date}', new Date().toISOString().split('T')[0])
        .replace('{postId}', context.postId || '');
    };

    return {
      source: resolve(template.source),
      medium: resolve(template.medium),
      campaign: resolve(template.campaign),
      term: resolve(template.term),
      content: resolve(template.content),
    };
  }
}

export interface UTMTemplate {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface UTMContext {
  platform?: string;
  companyName?: string;
  postId?: string;
}
