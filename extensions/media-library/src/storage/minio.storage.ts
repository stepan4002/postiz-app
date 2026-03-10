/**
 * MinioStorage — S3-compatible storage provider for MinIO.
 *
 * Implements IUploadProvider from @gitroom/nestjs-libraries/upload/upload.interface.
 * CRITICAL: forcePathStyle: true is required for MinIO — without it, the SDK attempts
 * virtual-hosted-style URLs (bucket.endpoint) which MinIO doesn't support by default.
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import mime from 'mime-types';
import { IUploadProvider } from '@gitroom/nestjs-libraries/upload/upload.interface';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

/**
 * Upload a buffer directly to MinIO/S3.
 * Exported for use by thumbnail and variant upload pipelines (Plan 02/03).
 */
export async function uploadBufferToMinio(
  client: S3Client,
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await client.send(command);
}

export class MinioStorage implements IUploadProvider {
  private _client: S3Client;

  constructor(
    private readonly endpoint: string,
    private readonly accessKeyId: string,
    private readonly secretAccessKey: string,
    private readonly bucketName: string,
    private readonly publicUrl: string
  ) {
    this._client = new S3Client({
      endpoint,
      region: 'us-east-1',
      // CRITICAL: Required for MinIO — prevents virtual-hosted-style URL generation
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  /**
   * Idempotent bucket creation — called at startup to ensure the bucket exists.
   * Uses HeadBucketCommand to check, then CreateBucketCommand if 404.
   */
  static async ensureBucket(client: S3Client, bucket: string): Promise<void> {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (err: any) {
      const statusCode = err?.$metadata?.httpStatusCode ?? err?.statusCode;
      if (statusCode === 404 || err?.name === 'NoSuchBucket' || err?.Code === 'NoSuchBucket') {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      } else {
        throw err;
      }
    }
  }

  /**
   * Upload a multer file to MinIO.
   * Returns a standard upload result compatible with the Postiz file upload pipeline.
   */
  async uploadFile(file: Express.Multer.File): Promise<any> {
    const id = makeId(10);
    const extension = mime.extension(file.mimetype) || 'bin';
    const key = `${id}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this._client.send(command);

    const path = `${this.publicUrl}/${key}`;

    return {
      filename: key,
      mimetype: file.mimetype,
      size: file.size,
      buffer: file.buffer,
      originalname: key,
      fieldname: 'file',
      path,
      destination: path,
      encoding: '7bit',
      stream: file.buffer as any,
    };
  }

  /**
   * Fetch a URL and upload the content to MinIO.
   * Returns the public URL of the uploaded object.
   */
  async uploadSimple(url: string): Promise<string> {
    const response = await fetch(url);
    const contentType =
      response.headers.get('content-type') ||
      response.headers.get('Content-Type') ||
      'application/octet-stream';
    const extension = mime.extension(contentType) || 'bin';
    const id = makeId(10);
    const key = `${id}.${extension}`;

    const buffer = Buffer.from(await response.arrayBuffer());

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this._client.send(command);

    return `${this.publicUrl}/${key}`;
  }

  /**
   * Remove an object from MinIO by its full public URL path.
   * Extracts the key by stripping the publicUrl prefix.
   */
  async removeFile(filePath: string): Promise<void> {
    // Strip trailing slash from publicUrl for consistent key extraction
    const baseUrl = this.publicUrl.endsWith('/')
      ? this.publicUrl.slice(0, -1)
      : this.publicUrl;
    const key = filePath.startsWith(baseUrl + '/')
      ? filePath.slice(baseUrl.length + 1)
      : filePath;

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this._client.send(command);
  }

  /**
   * Expose the underlying S3Client for use by uploadBufferToMinio utility.
   */
  get client(): S3Client {
    return this._client;
  }
}

export default MinioStorage;
