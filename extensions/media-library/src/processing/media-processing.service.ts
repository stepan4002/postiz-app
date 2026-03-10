/**
 * MediaProcessingService
 *
 * Async variant generation service.
 *
 * Pipeline:
 *   1. Load Media record from DB (get path, companyId)
 *   2. Download original file from MinIO (GetObjectCommand)
 *   3. For each platform, look up PLATFORM_VARIANT_SPECS[platform]
 *   4. For each spec, call generateVariant (sharp cover resize → JPEG 85)
 *   5. Upload variant to MinIO: key = {companyId}/{mediaId}/variants/{platform}_{w}x{h}.jpg
 *   6. Create MediaVariant DB record
 *
 * Called by MediaProcessingJob cron (plan 03) — never directly by web requests.
 */

import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { uploadBufferToMinio } from '../storage/minio.storage';
import { PLATFORM_VARIANT_SPECS } from './platform-specs';
import type { VariantSpec, VariantResult } from '../types';

export interface MediaProcessingMinioConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

@Injectable()
export class MediaProcessingService {
  constructor(
    private readonly prisma: any,
    private readonly minioConfig: MediaProcessingMinioConfig
  ) {}

  /**
   * Generate a single image variant using sharp.
   *
   * Resizes the source buffer to the exact platform dimensions using 'cover' fit
   * with 'centre' position, then encodes as JPEG quality 85.
   *
   * @param sourceBuffer  Raw image bytes from MinIO
   * @param spec          Target platform/width/height
   * @throws Error with descriptive message if sharp fails (e.g., corrupt input)
   */
  async generateVariant(sourceBuffer: Buffer, spec: VariantSpec): Promise<VariantResult> {
    try {
      const buffer = await sharp(sourceBuffer)
        .resize(spec.width, spec.height, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 85 })
        .toBuffer();

      return {
        buffer,
        width: spec.width,
        height: spec.height,
        format: 'jpeg',
        fileSize: buffer.length,
      };
    } catch (err: any) {
      throw new Error(
        `Failed to generate variant for platform ${spec.platform} at ${spec.width}x${spec.height}: ${err?.message ?? err}`
      );
    }
  }

  /**
   * Generate and store all platform variants for a media record.
   *
   * Downloads the original from MinIO, generates variants for each platform spec,
   * uploads each variant, and creates MediaVariant DB records.
   *
   * @param mediaId    ID of the Media record to process
   * @param platforms  List of platform keys (e.g., ['instagram', 'facebook'])
   */
  async generateVariants(mediaId: string, platforms: string[]): Promise<void> {
    // Step 1: Load Media record from DB
    const media = await this.prisma.media.findUnique({
      where: { id: mediaId },
      select: { id: true, path: true, companyId: true },
    });

    if (!media) {
      throw new Error(`Media record not found: ${mediaId}`);
    }

    // Step 2: Download original from MinIO
    const client = new S3Client({
      endpoint: this.minioConfig.endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this.minioConfig.accessKeyId,
        secretAccessKey: this.minioConfig.secretAccessKey,
      },
      forcePathStyle: true,
    });

    const downloadResult = await client.send(
      new GetObjectCommand({
        Bucket: this.minioConfig.bucket,
        Key: media.path,
      })
    );

    // Convert S3 stream/body to Buffer
    const bodyBytes = await (downloadResult.Body as any).transformToByteArray();
    const originalBuffer = Buffer.from(bodyBytes);

    // Step 3-6: For each platform, generate and store all specs
    for (const platform of platforms) {
      const specs = PLATFORM_VARIANT_SPECS[platform] ?? [];

      for (const spec of specs) {
        // Step 4: Generate variant buffer via sharp
        const variantResult = await this.generateVariant(originalBuffer, spec);

        // Step 5: Build MinIO key and upload
        const variantKey = `${media.companyId}/${mediaId}/variants/${platform}_${spec.width}x${spec.height}.jpg`;
        await uploadBufferToMinio(
          client,
          this.minioConfig.bucket,
          variantKey,
          variantResult.buffer,
          'image/jpeg'
        );

        // Step 6: Create MediaVariant DB record
        await this.prisma.mediaVariant.create({
          data: {
            mediaId,
            platform,
            width: spec.width,
            height: spec.height,
            path: variantKey,
            fileSize: variantResult.fileSize,
          },
        });
      }
    }
  }
}
