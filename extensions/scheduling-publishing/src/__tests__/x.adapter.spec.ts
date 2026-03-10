// ============================================================================
// X (Twitter) Adapter Tests — TDD RED phase
// Tests tweet creation via X API v2, OAuth 1.0a signing, media upload,
// and error classification.
// ============================================================================

import { XAdapter } from '../adapters/x.adapter';
import { PublishParams } from '../types/publishing.types';

// Mock env vars for OAuth consumer credentials
const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env.X_CLIENT_ID = 'test-consumer-key';
  process.env.X_CLIENT_SECRET = 'test-consumer-secret';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  jest.restoreAllMocks();
});

describe('XAdapter', () => {
  let adapter: XAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new XAdapter();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  const baseParams: PublishParams = {
    variant: {
      id: 'variant-1',
      postId: 'post-1',
      platform: 'x',
      caption: 'Hello from X API v2!',
      hashtags: ['#api', '#test'],
    },
    // X tokens are stored as "token:secret" composite (Phase 2 decision)
    accessToken: 'oauth-token:oauth-token-secret',
  };

  // Test 6: publish() creates tweet via /2/tweets
  it('creates a tweet via POST /2/tweets', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: 'tweet-12345', text: 'Hello from X API v2! #api #test' } }),
      text: async () => JSON.stringify({ data: { id: 'tweet-12345', text: 'Hello from X API v2! #api #test' } }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('api.x.com/2/tweets');
  });

  // Test 7: text-only tweet works
  it('successfully publishes a text-only tweet', async () => {
    const textOnlyParams: PublishParams = {
      ...baseParams,
      mediaUrl: undefined,
      mediaBuffer: undefined,
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: 'tweet-text-only', text: 'Hello!' } }),
      text: async () => JSON.stringify({ data: { id: 'tweet-text-only', text: 'Hello!' } }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(textOnlyParams);

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe('tweet-text-only');
    expect(result.platformUrl).toContain('x.com');
    expect(result.platformUrl).toContain('tweet-text-only');
  });

  // Test 8: with image, uploads media first then creates tweet with media_ids
  it('uploads media then creates tweet with media_ids', async () => {
    const imageParams: PublishParams = {
      ...baseParams,
      mediaUrl: 'https://example.com/image.jpg',
    };

    // First: upload media
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ media_id_string: 'media-987654' }),
      text: async () => JSON.stringify({ media_id_string: 'media-987654' }),
      headers: { get: () => null },
    } as any);

    // Second: create tweet
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: 'tweet-with-media', text: 'Hello with image!' } }),
      text: async () => JSON.stringify({ data: { id: 'tweet-with-media', text: 'Hello with image!' } }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(imageParams);

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(result.platformPostId).toBe('tweet-with-media');

    // Verify media upload was attempted
    const mediaUploadCall = fetchSpy.mock.calls[0][0] as string;
    expect(mediaUploadCall).toContain('upload.x.com');

    // Verify tweet body includes media_ids
    const tweetCall = fetchSpy.mock.calls[1];
    const tweetBody = JSON.parse(tweetCall[1].body as string);
    expect(tweetBody.media).toBeDefined();
    expect(tweetBody.media.media_ids).toContain('media-987654');
  });

  // Test 9: classifies 403 as permanent (policy violation)
  it('classifies 403 as permanent, retryable: false', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ title: 'Forbidden', detail: 'Your tweet violates policy' }),
      text: async () => JSON.stringify({ title: 'Forbidden', detail: 'Your tweet violates policy' }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(false);
    expect(result.errorType).toBe('permanent');
  });

  // Additional: has pinned apiVersion
  it('has platform = x and pinned apiVersion = 2', () => {
    expect(adapter.platform).toBe('x');
    expect(adapter.apiVersion).toBe('2');
  });

  // Additional: sets Authorization header with OAuth 1.0a
  it('sets Authorization header with OAuth 1.0a signature', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: 'tweet-auth', text: 'Test' } }),
      text: async () => JSON.stringify({ data: { id: 'tweet-auth', text: 'Test' } }),
      headers: { get: () => null },
    } as any);

    await adapter.publish(baseParams);

    const callOptions = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = callOptions.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^OAuth /);
    expect(headers['Authorization']).toContain('oauth_signature');
  });
});

describe('AdapterRegistry', () => {
  // Test 10: getAdapter('instagram') returns InstagramAdapter
  it('getAdapter("instagram") returns an adapter with platform = instagram', async () => {
    const { AdapterRegistry } = await import('../adapters/adapter-registry');
    const registry = new AdapterRegistry();
    const adapter = registry.getAdapter('instagram');
    expect(adapter.platform).toBe('instagram');
  });

  // Test 11: getAdapter('unknown') throws error
  it('getAdapter("unknown") throws an error', async () => {
    const { AdapterRegistry } = await import('../adapters/adapter-registry');
    const registry = new AdapterRegistry();
    expect(() => registry.getAdapter('unknown')).toThrow('No adapter for platform: unknown');
  });

  // Test 12: all 4 platforms registered
  it('getSupportedPlatforms returns all 4 MVP platforms', async () => {
    const { AdapterRegistry } = await import('../adapters/adapter-registry');
    const registry = new AdapterRegistry();
    const platforms = registry.getSupportedPlatforms();
    expect(platforms).toContain('instagram');
    expect(platforms).toContain('facebook');
    expect(platforms).toContain('linkedin');
    expect(platforms).toContain('x');
    expect(platforms).toHaveLength(4);
  });
});
