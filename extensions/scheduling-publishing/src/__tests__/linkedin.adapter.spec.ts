// ============================================================================
// LinkedIn Adapter Tests — TDD RED phase
// Tests the LinkedIn REST API v2 UGC post creation, media upload flow,
// error classification, and API version pinning.
// ============================================================================

import { LinkedInAdapter } from '../adapters/linkedin.adapter';
import { PublishParams } from '../types/publishing.types';

describe('LinkedInAdapter', () => {
  let adapter: LinkedInAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new LinkedInAdapter();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const baseParams: PublishParams = {
    variant: {
      id: 'variant-1',
      postId: 'post-1',
      platform: 'linkedin',
      caption: 'Exciting LinkedIn post about our product',
      hashtags: ['#linkedin', '#tech'],
    },
    accessToken: 'li-access-token',
    platformAccountId: 'person-abc123',
  };

  // Test 1: publish() creates UGC post via /ugcPosts endpoint
  it('creates a UGC post via the LinkedIn posts API', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
      text: async () => '{}',
      headers: {
        get: (name: string) => (name === 'x-restli-id' ? 'urn:li:ugcPost:123456' : null),
      },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const callUrl = fetchSpy.mock.calls[0][0] as string;
    expect(callUrl).toContain('linkedin.com');
    expect(callUrl).toContain('posts');
  });

  // Test 2: text-only post works without media
  it('successfully publishes a text-only post', async () => {
    const textOnlyParams: PublishParams = {
      ...baseParams,
      mediaUrl: undefined,
      mediaBuffer: undefined,
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
      text: async () => '{}',
      headers: {
        get: (name: string) => (name === 'x-restli-id' ? 'urn:li:ugcPost:789' : null),
      },
    } as any);

    const result = await adapter.publish(textOnlyParams);

    expect(result.success).toBe(true);
    expect(result.platformPostId).toBe('urn:li:ugcPost:789');
  });

  // Test 3: with image, registers upload then creates post with media reference
  it('registers image upload and creates post with media reference', async () => {
    const imageParams: PublishParams = {
      ...baseParams,
      mediaUrl: 'https://example.com/image.jpg',
    };

    // Step 1: Initialize upload
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        value: {
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: 'https://api.linkedin.com/upload/img',
            },
          },
          image: 'urn:li:image:abc123',
        },
      }),
      text: async () => JSON.stringify({
        value: {
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: 'https://api.linkedin.com/upload/img',
            },
          },
          image: 'urn:li:image:abc123',
        },
      }),
      headers: { get: () => null },
    } as any);

    // Step 2: Upload binary (PUT)
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
      text: async () => '',
      headers: { get: () => null },
    } as any);

    // Step 3: Create post with media reference
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
      text: async () => '{}',
      headers: {
        get: (name: string) => (name === 'x-restli-id' ? 'urn:li:ugcPost:media999' : null),
      },
    } as any);

    const result = await adapter.publish(imageParams);

    expect(result.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.platformPostId).toBe('urn:li:ugcPost:media999');
  });

  // Test 4: classifies 429 as rate_limit
  it('classifies 429 as rate_limit, retryable: true', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: 'Too Many Requests' }),
      text: async () => JSON.stringify({ message: 'Too Many Requests' }),
      headers: { get: () => null },
    } as any);

    const result = await adapter.publish(baseParams);

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
    expect(result.errorType).toBe('rate_limit');
  });

  // Test 5: apiVersion is '202501' (YYYYMM format for LinkedIn)
  it('has platform = linkedin and pinned apiVersion = 202501', () => {
    expect(adapter.platform).toBe('linkedin');
    expect(adapter.apiVersion).toBe('202501');
  });

  // Additional: sets LinkedIn-Version header
  it('sets LinkedIn-Version header to apiVersion on requests', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({}),
      text: async () => '{}',
      headers: {
        get: (name: string) => (name === 'x-restli-id' ? 'urn:li:ugcPost:hdr' : null),
      },
    } as any);

    await adapter.publish(baseParams);

    const callOptions = fetchSpy.mock.calls[0][1] as RequestInit;
    const headers = callOptions.headers as Record<string, string>;
    expect(headers['LinkedIn-Version']).toBe('202501');
  });
});
