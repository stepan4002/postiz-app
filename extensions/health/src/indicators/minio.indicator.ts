/**
 * MinioHealthIndicator — Phase 8 Plan 01
 * Checks MinIO connectivity by running HeadBucket against the configured bucket.
 * Uses @aws-sdk/client-s3 with forcePathStyle: true (same pattern as MediaLibrary).
 */
import { Injectable } from '@nestjs/common';
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from '@nestjs/terminus';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';

@Injectable()
export class MinioHealthIndicator extends HealthIndicator {
  private s3Client: S3Client;
  private bucket: string;

  constructor() {
    super();
    // Create S3Client for MinIO with forcePathStyle: true (same pattern as extensions/media-library)
    this.s3Client = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
      region: 'us-east-1',
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY ?? '',
        secretAccessKey: process.env.MINIO_SECRET_KEY ?? '',
      },
      forcePathStyle: true,
    });
    this.bucket = process.env.MINIO_BUCKET ?? 'social-media';
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return this.getStatus(key, true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      throw new HealthCheckError(
        'MinIO check failed',
        this.getStatus(key, false, { error: message }),
      );
    }
  }
}
