import { CloudflareStorage } from './cloudflare.storage';
import { IUploadProvider } from './upload.interface';
import { LocalStorage } from './local.storage';
// SOCIAL COMMAND CENTRE — Phase 4: MinIO storage provider
import { MinioStorage } from '@social/media-library';

export class UploadFactory {
  static createStorage(): IUploadProvider {
    const storageProvider = process.env.STORAGE_PROVIDER || 'local';

    switch (storageProvider) {
      case 'local':
        return new LocalStorage(process.env.UPLOAD_DIRECTORY!);
      case 'cloudflare':
        return new CloudflareStorage(
          process.env.CLOUDFLARE_ACCOUNT_ID!,
          process.env.CLOUDFLARE_ACCESS_KEY!,
          process.env.CLOUDFLARE_SECRET_ACCESS_KEY!,
          process.env.CLOUDFLARE_REGION!,
          process.env.CLOUDFLARE_BUCKETNAME!,
          process.env.CLOUDFLARE_BUCKET_URL!
        );
      // SOCIAL COMMAND CENTRE — Phase 4: S3-compatible MinIO storage
      case 's3':
        return new MinioStorage(
          process.env.MINIO_ENDPOINT!,
          process.env.MINIO_ACCESS_KEY!,
          process.env.MINIO_SECRET_KEY!,
          process.env.MINIO_BUCKET!,
          process.env.MINIO_PUBLIC_URL!
        );
      default:
        throw new Error(`Invalid storage type ${storageProvider}`);
    }
  }
}
