// ============================================================================
// Facebook Adapter Tests — TDD RED phase
// Tests the Graph API post creation, text-only and image posts, error
// classification, and platformUrl format.
// ============================================================================

import { FacebookAdapter } from '../adapters/facebook.adapter';
import { PublishParams } from '../types/publishing.types';

describe('FacebookAdapter', () => {
  let adapter: FacebookAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new FacebookAdapter();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const baseParams: PublishParams = {
    variant: {
      id: 'variant-1',
      postId: 'post-1',
      platform: 'facebook',
      caption: 'Test Facebook post',
      hashtags: ['#facebook', '#test'],
    },
    accessToken: 'fb-access-token',
    platformAccountId: 'page-123',
  };

  // Test 7: publish() creates post via Graph API /{page-id}/feed
  it('creates a text post via /{page-id}/feed', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'page-123_post-456' }),
      text: async () => JSON.stringify({ id: 'page-123_post-456' }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/page-123/feed');
  });

  // Test 8: handles text-only and text+image posts
  it('handles text+image post via /{page-id}/photos', async () => {
    const imageParams: PublishParams = {
      ...baseParams,
      mediaUrl: 'https://example.com/photo.jpg',
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'page-123_photo-789', post_id: 'page-123_post-789' }),
      text: async () => JSON.stringify({ id: 'page-123_photo-789', post_id: 'page-123_post-789' }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(imageParams);

    expect(result.success).toBe(true);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('/page-123/photos');
  });

  // Test 9: classifies errors correctly (same patterns as Instagram)
  it('classifies 429 as rate_limit, retryable: true', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded', code: 429 } }),
      text: async () => JSON.stringify({ error: { message: 'Rate limit exceeded', code: 429 } }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.errorType).toBe('rate_limit');
  });

  it('classifies 400 as permanent, retryable: false', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid parameter', code: 100 } }),
      text: async () => JSON.stringify({ error: { message: 'Invalid parameter', code: 100 } }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.errorType).toBe('permanent');
  });

  it('classifies 503 as transient, retryable: true', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: { message: 'Service unavailable', code: 2 } }),
      text: async () => JSON.stringify({ error: { message: 'Service unavailable', code: 2 } }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.errorType).toBe('transient');
  });

  // Test 10: returns platformUrl in format facebook.com/{page-id}/posts/{post-id}
  it('returns platformUrl in format facebook.com/{page-id}/posts/{post-id}', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'page-123_post-456' }),
      text: async () => JSON.stringify({ id: 'page-123_post-456' }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe('page-123_post-456');
    expect(result.platformUrl).toContain('facebook.com');
    expect(result.platformUrl).toContain('page-123');
    expect(result.platformUrl).toContain('post-456');
  });

  // Additional test: has pinned apiVersion
  it('has platform = facebook and pinned apiVersion = v21.0', () => {
    expect(adapter.platform).toBe('facebook');
    expect(adapter.apiVersion).toBe('v21.0');
  });
});
