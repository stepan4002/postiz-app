// ============================================================================
// Instagram Adapter Tests — TDD RED phase
// Tests the 2-step Meta container publish pattern, error classification,
// and idempotency checks.
// ============================================================================

import { InstagramAdapter } from '../adapters/instagram.adapter';
import { PublishParams } from '../types/publishing.types';

describe('InstagramAdapter', () => {
  let adapter: InstagramAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new InstagramAdapter();
    // Reset fetch spy
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const baseParams: PublishParams = {
    variant: {
      id: 'variant-1',
      postId: 'post-1',
      platform: 'instagram',
      caption: 'Test caption',
      hashtags: ['#test', '#social'],
    },
    accessToken: 'test-access-token',
    mediaUrl: 'https://example.com/image.jpg',
    platformAccountId: 'ig-user-123',
  };

  // Test 1: publish() creates media container, waits for ready, then publishes container
  it('creates media container, polls for FINISHED status, then publishes container', async () => {
    // Step 1: create container
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'container-123' }),
      text: async () => JSON.stringify({ id: 'container-123' }),
      headers: { get: () => null },
    } as any);

    // Step 2: poll status — FINISHED on first poll
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status_code: 'FINISHED' }),
      text: async () => JSON.stringify({ status_code: 'FINISHED' }),
      headers: { get: () => null },
    } as any);

    // Step 3: publish container
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'published-post-123' }),
      text: async () => JSON.stringify({ id: 'published-post-123' }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // First call: create container
    const createCall = fetchSpy.mock.calls[0];
    expect(createCall[0]).toContain('/ig-user-123/media');

    // Third call: publish container
    const publishCall = fetchSpy.mock.calls[2];
    expect(publishCall[0]).toContain('/ig-user-123/media_publish');
  });

  // Test 2: returns success with platformPostId and platformUrl
  it('returns success with platformPostId and platformUrl', async () => {
    fetchSpy
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'container-abc' }),
        text: async () => JSON.stringify({ id: 'container-abc' }),
        headers: { get: () => null },
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status_code: 'FINISHED' }),
        text: async () => JSON.stringify({ status_code: 'FINISHED' }),
        headers: { get: () => null },
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'post-xyz' }),
        text: async () => JSON.stringify({ id: 'post-xyz' }),
        headers: { get: () => null },
      } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe('post-xyz');
    expect(result.platformUrl).toContain('instagram.com');
    expect(result.retryable).toBe(false);
    expect(result.errorType).toBeUndefined();
  });

  // Test 3: classifies rate limit (429) as 'rate_limit' error type, retryable: true
  it('classifies HTTP 429 as rate_limit error, retryable: true', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Too many requests', code: 429 } }),
      text: async () => JSON.stringify({ error: { message: 'Too many requests', code: 429 } }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.errorType).toBe('rate_limit');
    expect(result.error).toBeDefined();
  });

  // Test 4: classifies auth error (error code 190) as 'permanent', retryable: false
  it('classifies auth error (code 190) as permanent, retryable: false', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid OAuth token', code: 190 } }),
      text: async () => JSON.stringify({ error: { message: 'Invalid OAuth token', code: 190 } }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.errorType).toBe('permanent');
  });

  // Test 5: classifies timeout/5xx as 'transient', retryable: true
  it('classifies 5xx server error as transient, retryable: true', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Internal server error', code: 1 } }),
      text: async () => JSON.stringify({ error: { message: 'Internal server error', code: 1 } }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.errorType).toBe('transient');
  });

  // Test 6: text-only post (no media) returns permanent error (Instagram requires media)
  it('returns permanent error for text-only post (Instagram requires media)', async () => {
    const textOnlyParams: PublishParams = {
      ...baseParams,
      mediaUrl: undefined,
      mediaBuffer: undefined,
    };

    const result = await adapter.publish(textOnlyParams);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.errorType).toBe('permanent');
    expect(result.error).toContain('media');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Additional test: has pinned apiVersion
  it('has platform = instagram and pinned apiVersion = v21.0', () => {
    expect(adapter.platform).toBe('instagram');
    expect(adapter.apiVersion).toBe('v21.0');
  });
});
