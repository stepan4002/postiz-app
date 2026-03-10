/**
 * PublishingService
 *
 * Orchestrates a single variant publish attempt:
 * 1. Resolve credentials via SocialAccount -> Integration join
 * 2. Decrypt access token
 * 3. Optionally download media buffer
 * 4. Optionally validate media via PlatformMediaValidator
 * 5. Resolve platform adapter via AdapterRegistry
 * 6. Call adapter.publish()
 * 7. Log the attempt via PublishAttemptLogger
 * 8. Return PublishResult
 *
 * This service does NOT handle retry logic — retries are orchestrated
 * by PublishingWorkerJob based on the returned PublishResult.
 */

import { Injectable } from '@nestjs/common';
import { AdapterRegistry } from '../adapters/adapter-registry';
import { PublishAttemptLogger } from './publish-attempt-logger';
import { PublishResult } from '../types/publishing.types';

@Injectable()
export class PublishingService {
  constructor(
    private readonly adapterRegistry: AdapterRegistry,
    private readonly tokenEncryption: any,
    private readonly attemptLogger: PublishAttemptLogger,
    private readonly platformMediaValidator: any,
    private readonly prisma: any,
  ) {}

  /**
   * Publish a single PostVariant to its target platform.
   *
   * Credential resolution path:
   *   Brand (on variant.post.brandId)
   *   -> SocialAccount (brandId + provider match)
   *   -> Integration (token + internalId)
   *
   * @param variant - The PostVariant record (with post relation included)
   * @returns PublishResult with success status and platform IDs or error info
   */
  async publishVariant(variant: any): Promise<PublishResult> {
    const attemptNumber = (variant.publishAttempts ?? 0) + 1;

    try {
      // 1. Resolve credentials via SocialAccount -> Integration join
      const socialAccount = await (this.prisma as any).socialAccount.findFirst({
        where: {
          provider: variant.platform,       // e.g. 'instagram'
          brandId: variant.post?.brandId,   // Brand associated with the ContentPost
        },
        include: {
          integration: true,  // Includes token, refreshToken, internalId
        },
      });

      if (!socialAccount || !socialAccount.integration) {
        return {
          success: false,
          error: `No connected ${variant.platform} account found for brand ${variant.post?.brandId}`,
          retryable: false,
          errorType: 'permanent',
        };
      }

      const integration = socialAccount.integration;

      // 2. Decrypt access token
      let accessToken = integration.token;
      try {
        if (this.tokenEncryption && typeof this.tokenEncryption.isEncrypted === 'function') {
          if (this.tokenEncryption.isEncrypted(accessToken)) {
            accessToken = this.tokenEncryption.decrypt(accessToken);
          }
        }
      } catch {
        // If decryption fails, try using the token as-is (may be unencrypted)
      }

      // 3. Optionally download media buffer (if variant has media)
      let mediaBuffer: Buffer | undefined;
      if (variant.mediaVariantId) {
        try {
          // Media download is best-effort — adapters can use mediaUrl fallback
          mediaBuffer = await this.downloadMediaBuffer(variant.mediaVariantId);
        } catch {
          // Non-fatal: adapters may work with mediaUrl or text-only
        }
      }

      // 4. Resolve platform adapter
      const adapter = this.adapterRegistry.getAdapter(variant.platform);

      // 5. Publish via platform adapter
      const publishResult = await adapter.publish({
        variant,
        accessToken,
        mediaBuffer,
        platformAccountId: integration.internalId,
      });

      return publishResult;

    } catch (err: any) {
      // Unexpected error (network, adapter crash, etc.) — treated as transient
      const errorMessage = err?.message ?? String(err);

      return {
        success: false,
        error: errorMessage,
        retryable: true,
        errorType: 'transient',
      };
    }
  }

  /**
   * Download a media file from MinIO by MediaVariant ID.
   * Returns a Buffer of the raw file bytes.
   *
   * This is best-effort — if download fails, publishing can still proceed
   * with text-only content (for platforms that support it).
   *
   * @param mediaVariantId - The MediaVariant DB ID to retrieve
   */
  private async downloadMediaBuffer(mediaVariantId: string): Promise<Buffer> {
    // Fetch the MediaVariant to get the S3 key
    const mediaVariant = await (this.prisma as any).mediaVariant.findUnique({
      where: { id: mediaVariantId },
      select: { url: true },
    });

    if (!mediaVariant) {
      throw new Error(`MediaVariant ${mediaVariantId} not found`);
    }

    // Import S3 SDK dynamically to avoid circular deps
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');

    const s3 = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? '',
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? '',
      },
      forcePathStyle: true,
    });

    const command = new GetObjectCommand({
      Bucket: process.env.MINIO_BUCKET ?? 'social-media',
      Key: mediaVariant.url,
    });

    const response = await s3.send(command);

    if (!response.Body) {
      throw new Error(`Empty response body for media ${mediaVariantId}`);
    }

    const bytes = await (response.Body as any).transformToByteArray();
    return Buffer.from(bytes);
  }
}
