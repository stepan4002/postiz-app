/**
 * InboxService
 *
 * Business logic layer for inbox monitoring operations.
 * Sits between InboxController and InboxRepository per project convention:
 *   Controller >> Service >> Repository
 *
 * Responsibilities:
 * - Validate that requested items belong to the requesting company (authorization)
 * - Orchestrate multi-step operations (e.g. generate AI reply + update sentiment)
 * - Apply business rules (e.g. read implies unread -> read transition only)
 * - Provide pagination defaults and filter normalization
 *
 * AI reply generation:
 * - generateAIReply() provides a simple keyword-based suggestion stub
 * - This is intentionally lightweight — a full LLM integration can replace
 *   the generateSuggestion() helper when an AI service is wired in
 * - The method also derives a sentiment label from the content for display
 *
 * Authorization:
 * - All methods that operate on a single item first verify the item belongs
 *   to the given companyId before performing any mutation
 * - Throws NotFoundException (mapped to 404) if item not found or wrong company
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InboxRepository, InboxFilters } from './inbox.repository';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(private readonly inboxRepository: InboxRepository) {}

  // ---------------------------------------------------------------------------
  // Read operations
  // ---------------------------------------------------------------------------

  /**
   * Retrieve a paginated list of inbox items for a company.
   *
   * Applies optional filters for platform, status, and type.
   * Page and limit have safe defaults (page=1, limit=20).
   * Limit is capped at 100 to prevent abuse.
   *
   * @param companyId - Company scope for the query
   * @param filters - Optional filter criteria
   * @param page - 1-based page number
   * @param limit - Items per page (max 100)
   */
  async getInbox(
    companyId: string,
    filters: InboxFilters = {},
    page = 1,
    limit = 20,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    this.logger.log(
      `getInbox: companyId=${companyId} filters=${JSON.stringify(filters)} page=${safePage} limit=${safeLimit}`,
    );

    return this.inboxRepository.findByCompany(companyId, filters, safePage, safeLimit);
  }

  /**
   * Return the count of unread inbox items for a company.
   *
   * Used to render the unread badge in the sidebar navigation.
   *
   * @param companyId - Company scope for the count
   */
  async getUnreadCount(companyId: string): Promise<{ count: number }> {
    const count = await this.inboxRepository.countUnread(companyId);
    return { count };
  }

  // ---------------------------------------------------------------------------
  // Status mutations
  // ---------------------------------------------------------------------------

  /**
   * Mark a single inbox item as read.
   *
   * Verifies the item belongs to the requesting company before updating.
   * Transitions: unread -> read (already-read items remain read — idempotent).
   *
   * @param id - InboxItem database ID
   * @param companyId - Company scope for authorization
   */
  async markAsRead(id: string, companyId: string): Promise<any> {
    const item = await this.assertOwnership(id, companyId);

    if (item.status === 'archived') {
      // Archived items should not be un-archived by a read action
      this.logger.log(`markAsRead: item ${id} is archived — skipping status update`);
      return item;
    }

    this.logger.log(`markAsRead: marking item ${id} as read`);
    return this.inboxRepository.updateStatus(id, 'read');
  }

  /**
   * Mark a single inbox item as archived.
   *
   * Verifies the item belongs to the requesting company before updating.
   * Archived items no longer appear in the default inbox view (filtered by status).
   * Archiving is terminal — archived items cannot be un-archived via this service.
   *
   * @param id - InboxItem database ID
   * @param companyId - Company scope for authorization
   */
  async markAsArchived(id: string, companyId: string): Promise<any> {
    await this.assertOwnership(id, companyId);

    this.logger.log(`markAsArchived: archiving item ${id}`);
    return this.inboxRepository.updateStatus(id, 'archived');
  }

  // ---------------------------------------------------------------------------
  // AI reply generation
  // ---------------------------------------------------------------------------

  /**
   * Generate an AI-powered reply suggestion for an inbox item.
   *
   * This implementation uses a keyword-based heuristic to produce a contextually
   * appropriate reply suggestion without requiring a live LLM connection.
   * The suggestion is returned to the controller for display in the UI — the user
   * can edit it before sending.
   *
   * Side effect: updates the item's sentiment field in the database based on
   * keyword analysis of the content.
   *
   * To wire in a full LLM (e.g. OpenAI, Anthropic): replace generateSuggestion()
   * with a call to AIService.complete() — the rest of the method remains unchanged.
   *
   * @param id - InboxItem database ID
   * @param companyId - Company scope for authorization
   * @returns Object with the generated reply suggestion and detected sentiment
   */
  async generateAIReply(
    id: string,
    companyId: string,
  ): Promise<{ suggestion: string; sentiment: string }> {
    const item = await this.assertOwnership(id, companyId);

    const sentiment = this.detectSentiment(item.content);
    const suggestion = this.generateSuggestion(item.content, item.type, sentiment);

    // Persist the detected sentiment for display in the UI
    await this.inboxRepository.updateSentiment(id, sentiment);

    this.logger.log(
      `generateAIReply: item=${id} sentiment=${sentiment} suggestion="${suggestion.substring(0, 60)}..."`,
    );

    return { suggestion, sentiment };
  }

  // ---------------------------------------------------------------------------
  // Reply persistence
  // ---------------------------------------------------------------------------

  /**
   * Save a reply text against an inbox item.
   *
   * Called when the user submits a reply from the UI after (optionally) editing
   * the AI suggestion. This persists the reply text and marks the item as read.
   *
   * Note: This method stores the reply text in the database — it does NOT
   * actually send the reply to the platform API. Platform reply sending
   * will be handled by platform-specific adapters when implemented.
   *
   * @param id - InboxItem database ID
   * @param companyId - Company scope for authorization
   * @param replyText - The reply text to store
   */
  async saveReply(id: string, companyId: string, replyText: string): Promise<any> {
    await this.assertOwnership(id, companyId);

    if (!replyText || replyText.trim().length === 0) {
      throw new Error('replyText must not be empty');
    }

    this.logger.log(`saveReply: saving reply for item ${id} (${replyText.length} chars)`);
    return this.inboxRepository.updateReply(id, replyText.trim());
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Verify that the inbox item exists and belongs to the given company.
   *
   * Throws NotFoundException if:
   * - The item does not exist
   * - The item's companyId does not match the requesting companyId
   *
   * This enforces row-level authorization: a user from Company A cannot
   * read or mutate Company B's inbox items even if they guess the ID.
   *
   * @param id - InboxItem database ID to check
   * @param companyId - Company the requesting user belongs to
   * @returns The item record if ownership is confirmed
   */
  private async assertOwnership(id: string, companyId: string): Promise<any> {
    const item = await this.inboxRepository.findById(id);

    if (!item || item.companyId !== companyId) {
      throw new NotFoundException(`Inbox item '${id}' not found`);
    }

    return item;
  }

  /**
   * Detect the sentiment of message content using keyword analysis.
   *
   * Classification rules (evaluated in order):
   * 1. Positive keywords present + no negative keywords -> 'positive'
   * 2. Negative keywords present + no positive keywords -> 'negative'
   * 3. Both positive and negative keywords present -> 'mixed'
   * 4. No keywords matched -> 'neutral'
   *
   * @param content - The message/comment text to analyze
   * @returns Sentiment classification string
   */
  private detectSentiment(content: string): string {
    const lower = content.toLowerCase();

    const positiveKeywords = [
      'love', 'great', 'amazing', 'awesome', 'fantastic', 'excellent',
      'good', 'nice', 'perfect', 'thank', 'thanks', 'helpful', 'best',
      'wonderful', 'brilliant', 'outstanding', 'superb', 'happy', 'glad',
    ];

    const negativeKeywords = [
      'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate', 'useless',
      'broken', 'disappointed', 'frustrating', 'annoying', 'problem', 'issue',
      'wrong', 'error', 'fail', 'failed', 'not working', 'doesn\'t work',
      'refund', 'cancel', 'complaint', 'angry', 'furious',
    ];

    const hasPositive = positiveKeywords.some((kw) => lower.includes(kw));
    const hasNegative = negativeKeywords.some((kw) => lower.includes(kw));

    if (hasPositive && hasNegative) return 'mixed';
    if (hasPositive) return 'positive';
    if (hasNegative) return 'negative';
    return 'neutral';
  }

  /**
   * Generate a contextual reply suggestion based on content, type, and sentiment.
   *
   * Produces a polite, professional reply template tailored to the item type
   * (comment, DM, mention, review) and the detected sentiment.
   *
   * This is a deterministic stub — replace with an LLM call when available.
   *
   * @param content - The original message content
   * @param type - The inbox item type
   * @param sentiment - The detected sentiment
   * @returns A suggested reply string
   */
  private generateSuggestion(
    content: string,
    type: 'comment' | 'dm' | 'mention' | 'review',
    sentiment: string,
  ): string {
    // Truncate content preview to avoid overly long suggestions
    const preview = content.length > 80
      ? content.substring(0, 77) + '...'
      : content;

    if (type === 'review') {
      if (sentiment === 'positive') {
        return `Thank you so much for your kind words! We're thrilled to hear that you had such a great experience. Your feedback means a lot to our team, and we look forward to serving you again!`;
      }
      if (sentiment === 'negative') {
        return `We're really sorry to hear that you had a disappointing experience. We take all feedback seriously and would love to make this right for you. Please reach out to us directly so we can address your concerns promptly.`;
      }
      return `Thank you for taking the time to leave a review! Your feedback helps us continue improving. We hope to see you again soon.`;
    }

    if (type === 'dm') {
      if (sentiment === 'negative') {
        return `Hi there! Thank you for reaching out. We're sorry to hear you're experiencing an issue. Our team is here to help — could you share a bit more detail so we can resolve this as quickly as possible?`;
      }
      return `Hi! Thanks for getting in touch. We appreciate you reaching out and will get back to you as soon as possible. Is there anything specific we can help you with today?`;
    }

    if (type === 'mention') {
      if (sentiment === 'positive') {
        return `Thank you so much for the mention — we really appreciate your support! It means a lot to us. Stay tuned for more updates!`;
      }
      return `Thanks for the mention! We'd love to learn more about what's on your mind. Feel free to send us a DM if you'd like to chat further.`;
    }

    // Default: comment
    if (sentiment === 'positive') {
      return `Thank you for your lovely comment! We're so glad you feel that way. Your support keeps us motivated — we truly appreciate it!`;
    }
    if (sentiment === 'negative') {
      return `Thank you for sharing your feedback. We're sorry to hear that you're not fully satisfied. Please reach out to our support team directly and we'll do everything we can to help resolve this.`;
    }

    // Neutral / mixed — reference the original content
    return `Thank you for your comment! We appreciate you engaging with us. Regarding: "${preview}" — we'd love to hear more of your thoughts. Feel free to reach out anytime!`;
  }
}
