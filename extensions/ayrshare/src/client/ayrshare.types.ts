/**
 * AyrShare API Types & Platform Mapping
 *
 * Type definitions for the AyrShare REST API (https://docs.ayrshare.com).
 * Covers posting, comments, DMs, analytics, profiles, media, and webhooks.
 *
 * Platform mapping: Postiz integration identifiers → AyrShare platform names.
 */

// ---------------------------------------------------------------------------
// Platform mapping
// ---------------------------------------------------------------------------

/** AyrShare platform names (as expected by the API). */
export type AyrSharePlatform =
  | 'bluesky'
  | 'facebook'
  | 'gmb'
  | 'instagram'
  | 'linkedin'
  | 'pinterest'
  | 'reddit'
  | 'snapchat'
  | 'telegram'
  | 'threads'
  | 'tiktok'
  | 'twitter'
  | 'youtube';

/** Maps Postiz provider identifiers to AyrShare platform names. */
export const POSTIZ_TO_AYRSHARE: Record<string, AyrSharePlatform> = {
  'x': 'twitter',
  'facebook': 'facebook',
  'facebook-page': 'facebook',
  'instagram': 'instagram',
  'instagram-standalone': 'instagram',
  'linkedin': 'linkedin',
  'linkedin-page': 'linkedin',
  'youtube': 'youtube',
  'tiktok': 'tiktok',
  'pinterest': 'pinterest',
  'reddit': 'reddit',
  'threads': 'threads',
  'bluesky': 'bluesky',
  'gmb': 'gmb',
  'telegram': 'telegram',
};

/** Postiz provider identifiers that AyrShare can manage. */
export const AYRSHARE_MANAGED_IDENTIFIERS = new Set<string>([
  'x',
  'facebook',
  'facebook-page',
  'instagram',
  'instagram-standalone',
  'linkedin',
  'linkedin-page',
  'youtube',
  'tiktok',
  'pinterest',
  'reddit',
  'threads',
  'bluesky',
  'gmb',
  'telegram',
]);

/** Platforms that support DMs through AyrShare. */
export const AYRSHARE_DM_PLATFORMS: AyrSharePlatform[] = [
  'facebook',
  'instagram',
  'twitter',
];

/** Platforms that support comments through AyrShare. */
export const AYRSHARE_COMMENT_PLATFORMS: AyrSharePlatform[] = [
  'bluesky',
  'facebook',
  'instagram',
  'linkedin',
  'reddit',
  'threads',
  'tiktok',
  'twitter',
  'youtube',
];

// ---------------------------------------------------------------------------
// Posting types
// ---------------------------------------------------------------------------

/** Platform-specific options for AyrShare post requests. */
export interface AyrShareFacebookOptions {
  title?: string;
  link?: string;
}

export interface AyrShareInstagramOptions {
  reels?: boolean;
  shareReelsFeed?: boolean;
  stories?: boolean;
  carouselIndicator?: boolean;
}

export interface AyrShareLinkedInOptions {
  visibility?: 'anyone' | 'connectionsOnly';
  title?: string;
  isArticle?: boolean;
  shareCommentary?: string;
}

export interface AyrShareYouTubeOptions {
  title: string;
  visibility?: 'public' | 'unlisted' | 'private';
  thumbNail?: string;
  playListId?: string;
  tags?: string[];
  madeForKids?: boolean;
  shorts?: boolean;
}

export interface AyrShareRedditOptions {
  title: string;
  subreddit: string;
  type?: 'link' | 'self';
}

export interface AyrSharePinterestOptions {
  title: string;
  boardId: string;
  link?: string;
  altText?: string;
}

export interface AyrShareTikTokOptions {
  title?: string;
  privacy?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

export interface AyrShareThreadsOptions {
  replyControl?: 'everyone' | 'profiles_mentioned' | 'followers';
}

export interface AyrShareGmbOptions {
  title?: string;
  callToAction?: { actionType: string; url: string };
  eventTitle?: string;
  startDate?: string;
  endDate?: string;
}

export interface AyrShareTelegramOptions {
  sendAsPhoto?: boolean;
  webPagePreview?: boolean;
}

/** Create post request body. */
export interface AyrSharePostRequest {
  post: string;
  platforms: AyrSharePlatform[];
  mediaUrls?: string[];
  scheduleDate?: string; // UTC ISO 8601
  shortenLinks?: boolean;
  autoHashtag?: boolean;
  autoEmoji?: boolean;
  // Platform-specific options
  faceBookOptions?: AyrShareFacebookOptions;
  instagramOptions?: AyrShareInstagramOptions;
  linkedInOptions?: AyrShareLinkedInOptions;
  youTubeOptions?: AyrShareYouTubeOptions;
  redditOptions?: AyrShareRedditOptions;
  pinterestOptions?: AyrSharePinterestOptions;
  tikTokOptions?: AyrShareTikTokOptions;
  threadsOptions?: AyrShareThreadsOptions;
  gmbOptions?: AyrShareGmbOptions;
  telegramOptions?: AyrShareTelegramOptions;
}

/** Individual platform result within a post response. */
export interface AyrSharePlatformResult {
  platform: AyrSharePlatform;
  id?: string;
  postUrl?: string;
  status: string;
  errors?: string[];
}

/** Create post response. */
export interface AyrSharePostResponse {
  status: string;
  errors?: any[];
  postIds?: AyrSharePlatformResult[];
  id?: string; // AyrShare internal post ID
  refId?: string; // User reference ID
}

/** Post details (from GET /post/:id). */
export interface AyrSharePostDetails {
  id: string;
  post: string;
  platforms: AyrSharePlatform[];
  mediaUrls?: string[];
  scheduleDate?: string;
  status: string;
  postIds?: AyrSharePlatformResult[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Comments types
// ---------------------------------------------------------------------------

export interface AyrShareComment {
  id: string;
  platform: AyrSharePlatform;
  text: string;
  author?: string;
  authorId?: string;
  createdAt?: string;
  replies?: AyrShareComment[];
}

export interface AyrShareCommentsResponse {
  comments: AyrShareComment[];
  platform: AyrSharePlatform;
}

export interface AyrShareCommentRequest {
  comment: string;
  platforms?: AyrSharePlatform[];
}

export interface AyrShareCommentResponse {
  status: string;
  commentId?: string;
  errors?: any[];
}

export interface AyrShareReplyRequest {
  reply: string;
  platform: AyrSharePlatform;
}

// ---------------------------------------------------------------------------
// Messages / DM types
// ---------------------------------------------------------------------------

export interface AyrShareSendMessageRequest {
  message: string;
  recipientId: string;
  mediaUrls?: string[];
}

export interface AyrShareMessageResponse {
  status: string;
  messageId?: string;
  errors?: any[];
}

export interface AyrShareConversation {
  id: string;
  platform: AyrSharePlatform;
  participantName?: string;
  participantId?: string;
  lastMessage?: string;
  updatedAt?: string;
}

export interface AyrShareMessagesResponse {
  messages: Array<{
    id: string;
    text: string;
    from: string;
    to?: string;
    createdAt: string;
    mediaUrls?: string[];
  }>;
  conversationId?: string;
}

// ---------------------------------------------------------------------------
// Analytics types
// ---------------------------------------------------------------------------

export interface AyrSharePostAnalytics {
  platform: AyrSharePlatform;
  likes?: number;
  comments?: number;
  shares?: number;
  views?: number;
  impressions?: number;
  reach?: number;
  engagement?: number;
  clicks?: number;
  saves?: number;
}

export interface AyrShareSocialAnalytics {
  platform: AyrSharePlatform;
  followers?: number;
  following?: number;
  posts?: number;
  engagementRate?: number;
  impressions?: number;
  reach?: number;
}

// ---------------------------------------------------------------------------
// Profile types
// ---------------------------------------------------------------------------

export interface AyrShareCreateProfileRequest {
  title: string;
}

export interface AyrShareCreateProfileResponse {
  status: string;
  profileKey: string;
  title: string;
  createdAt: string;
}

export interface AyrShareGenerateJWTRequest {
  profileKey: string;
  domain: string;
}

export interface AyrShareGenerateJWTResponse {
  status: string;
  url: string;
}

export interface AyrShareProfileInfo {
  profileKey: string;
  title: string;
  activeSocialAccounts?: AyrSharePlatform[];
  displayNames?: Record<string, string>;
  createdAt: string;
}

export interface AyrShareUnlinkRequest {
  profileKey: string;
  platform: AyrSharePlatform;
}

// ---------------------------------------------------------------------------
// Media types
// ---------------------------------------------------------------------------

export interface AyrShareMediaUploadRequest {
  file: string; // Base64 encoded
  fileName: string;
  description?: string;
}

export interface AyrShareMediaUploadResponse {
  status: string;
  url: string;
  accessUrl?: string;
}

export interface AyrSharePresignedUrlRequest {
  fileName: string;
  contentType: string;
}

export interface AyrSharePresignedUrlResponse {
  uploadUrl: string;
  accessUrl: string;
  contentType: string;
}

// ---------------------------------------------------------------------------
// Webhook types
// ---------------------------------------------------------------------------

export type AyrShareWebhookType = 'scheduled' | 'social' | 'messages';

export interface AyrShareRegisterWebhookRequest {
  action: AyrShareWebhookType;
  url: string;
}

export interface AyrShareRegisterWebhookResponse {
  status: string;
  id: string;
}

/** Incoming webhook payload: post status update. */
export interface AyrSharePostWebhookPayload {
  action: 'scheduled';
  status: string;
  id: string; // AyrShare post ID
  postIds?: AyrSharePlatformResult[];
  profileKey?: string;
  errors?: any[];
}

/** Incoming webhook payload: social account linked/unlinked. */
export interface AyrShareSocialWebhookPayload {
  action: 'social';
  platform: AyrSharePlatform;
  event: 'linked' | 'unlinked';
  profileKey: string;
  displayName?: string;
}

/** Incoming webhook payload: incoming DM. */
export interface AyrShareMessageWebhookPayload {
  action: 'messages';
  platform: AyrSharePlatform;
  messageId: string;
  from: string;
  fromId: string;
  text: string;
  mediaUrls?: string[];
  profileKey: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Validation types
// ---------------------------------------------------------------------------

export interface AyrShareValidatePostRequest {
  post: string;
  platforms: AyrSharePlatform[];
  mediaUrls?: string[];
}

export interface AyrShareValidationResult {
  valid: boolean;
  errors?: Array<{
    platform: AyrSharePlatform;
    message: string;
    field?: string;
  }>;
}

// ---------------------------------------------------------------------------
// History types
// ---------------------------------------------------------------------------

export interface AyrShareHistoryEntry {
  id: string;
  post: string;
  platforms: AyrSharePlatform[];
  status: string;
  createdAt: string;
  postIds?: AyrSharePlatformResult[];
}

// ---------------------------------------------------------------------------
// Status / generic response types
// ---------------------------------------------------------------------------

export interface AyrShareStatusResponse {
  status: string;
  id?: string;
  postIds?: AyrSharePlatformResult[];
  errors?: any[];
}

export interface AyrShareErrorResponse {
  status: 'error';
  message: string;
  code?: number;
}

// ---------------------------------------------------------------------------
// Internal DTOs (for Postiz controller layer)
// ---------------------------------------------------------------------------

export interface CreateAyrShareConfigDto {
  apiKey: string;
  planType?: string;
  maxProfiles?: number;
}

export interface UpdateAyrShareConfigDto {
  apiKey?: string;
  planType?: string;
  maxProfiles?: number;
  enabled?: boolean;
}

export interface CreateAyrShareProfileDto {
  companyId: string;
  brandId?: string;
  languageCode: string;
  languageName: string;
  title: string;
}

export interface UpdateAyrShareProfileDto {
  title?: string;
  languageName?: string;
  brandId?: string;
  enabled?: boolean;
}

export interface AyrShareConfigResponse {
  id: string;
  organizationId: string;
  apiKeyMasked: string;
  planType: string;
  maxProfiles: number;
  enabled: boolean;
  lastVerifiedAt: Date | null;
}

export interface AyrShareQuotaResponse {
  used: number;
  max: number;
  remaining: number;
}
