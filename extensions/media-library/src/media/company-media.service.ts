/**
 * CompanyMediaService
 *
 * Upload + thumbnail + metadata extraction service.
 *
 * Upload pipeline:
 *   1. Extract metadata (width, height, format) via sharp
 *   2. Generate 300x300 max JPEG thumbnail preserving aspect ratio
 *   3. Upload original to MinIO: {companyId}/{mediaId}/{originalname}
 *   4. Upload thumbnail to MinIO: {companyId}/{mediaId}/thumb_{originalname}.jpg
 *   5. Create DB record via CompanyMediaRepository
 *   6. Return MediaUploadResult
 */
import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { CompanyMediaRepository } from './company-media.repository';
import { uploadBufferToMinio } from '../storage/minio.storage';
import { MediaUploadResult } from '../types';
import { ListMediaQueryDto } from './dtos/list-media-query.dto';
import { UploadMediaDto } from './dtos/upload-media.dto';

export interface MinioConfig {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicUrl: string;
}

@Injectable()
export class CompanyMediaService {
  constructor(
    private readonly _repository: CompanyMediaRepository,
    private readonly _minioConfig: MinioConfig
  ) {}

  /**
   * Full upload pipeline: file -> metadata extraction -> thumbnail -> MinIO -> DB record.
   *
   * @param companyId  Company that owns this media
   * @param organizationId Postiz organization (required for Media.organizationId FK)
   * @param file  Multer file with buffer populated (memoryStorage)
   * @param dto  Upload metadata: tags, alt text
   */
  async uploadAndRecord(
    companyId: string,
    organizationId: string,
    file: Express.Multer.File,
    dto: UploadMediaDto
  ): Promise<MediaUploadResult> {
    const buffer = file.buffer;
    const originalname = file.originalname;
    const mimetype = file.mimetype;

    // Step 1: Extract image metadata via sharp
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const format = metadata.format ?? mimetype.replace('image/', '');

    // Step 2: Generate 300x300 max thumbnail, JPEG quality 80
    // fit: 'inside' preserves aspect ratio and never upscales beyond 300x300
    const thumbBuffer = await sharp(buffer)
      .resize(300, 300, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Step 3: Generate mediaId to use as path prefix before DB insert
    const mediaId = uuidv4();

    // Step 4: Build MinIO paths
    const originalKey = `${companyId}/${mediaId}/${originalname}`;
    const thumbKey = `${companyId}/${mediaId}/thumb_${originalname}.jpg`;

    // Step 5: Upload original and thumbnail to MinIO
    // Import S3Client lazily to allow mocking in tests
    const { S3Client } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint: this._minioConfig.endpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: this._minioConfig.accessKeyId,
        secretAccessKey: this._minioConfig.secretAccessKey,
      },
      forcePathStyle: true,
    });

    await uploadBufferToMinio(client, this._minioConfig.bucket, originalKey, buffer, mimetype);
    await uploadBufferToMinio(client, this._minioConfig.bucket, thumbKey, thumbBuffer, 'image/jpeg');

    // Step 6: Create DB record
    const media = await this._repository.createMedia({
      name: originalname,
      path: originalKey,
      thumbnail: thumbKey,
      organizationId,
      companyId,
      fileSize: buffer.length,
      type: 'image',
      width,
      height,
      format,
      tags: dto.tags ?? [],
      alt: dto.alt,
    });

    // Step 7: Return MediaUploadResult
    return {
      id: media.id ?? mediaId,
      path: originalKey,
      thumbnailPath: thumbKey,
      width,
      height,
      format,
      fileSize: buffer.length,
    };
  }

  /**
   * List media for a company with optional tag filtering and pagination.
   */
  listMedia(companyId: string, query: ListMediaQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    return this._repository.findByCompany(companyId, page, limit, query.tag);
  }

  /**
   * Get a single media record with its variants.
   */
  getMedia(id: string) {
    return this._repository.findById(id);
  }

  /**
   * Soft-delete a media record.
   */
  deleteMedia(id: string) {
    return this._repository.deleteMedia(id);
  }

  /**
   * Queue asynchronous variant generation for the specified platforms.
   * Actual processing is handled by MediaProcessingJob cron (Plan 03).
   */
  queueVariantGeneration(mediaId: string, platforms: string[]) {
    return this._repository.createProcessingJob(mediaId, platforms);
  }
}
