/**
 * CompanyMediaController
 *
 * Company-scoped media REST endpoints.
 *
 * Route prefix: /companies/:companySlug/media
 *
 * Design decisions:
 * - Controller resolves companySlug to companyId before calling any service method
 * - Services receive IDs only (per project convention — see STATE.md: "Controller slug resolution")
 * - FileInterceptor uses memoryStorage() so file.buffer is populated for sharp processing
 *
 * Endpoints:
 *   POST   /companies/:companySlug/media/upload             — upload a media file
 *   GET    /companies/:companySlug/media                    — list company media
 *   GET    /companies/:companySlug/media/:mediaId           — get single media with variants
 *   DELETE /companies/:companySlug/media/:mediaId           — soft-delete media
 *   POST   /companies/:companySlug/media/:mediaId/process   — queue variant generation
 *
 * Uppy S3 Multipart endpoints (used by uppy.upload.ts 's3' case):
 *   POST   /companies/:companySlug/media/multipart/create-multipart-upload
 *   POST   /companies/:companySlug/media/multipart/list-parts
 *   POST   /companies/:companySlug/media/multipart/sign-part
 *   POST   /companies/:companySlug/media/multipart/abort-multipart-upload
 *   POST   /companies/:companySlug/media/multipart/complete-multipart-upload
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CompanyMediaService } from './company-media.service';
import { UploadMediaDto } from './dtos/upload-media.dto';
import { ListMediaQueryDto } from './dtos/list-media-query.dto';
import { MinioStorage } from '../storage/minio.storage';

@Controller('companies/:companySlug/media')
export class CompanyMediaController {
  private readonly logger = new Logger(CompanyMediaController.name);

  constructor(
    private readonly _companyMediaService: CompanyMediaService,
    private readonly _prisma: any,
    private readonly _minioStorage: MinioStorage
  ) {}

  /**
   * POST /companies/:companySlug/media/upload
   *
   * Accepts a multipart/form-data upload with a 'file' field.
   * Resolves companySlug to companyId, then delegates to service.
   * Returns MediaUploadResult with id, path, thumbnailPath, dimensions, format, fileSize.
   */
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
    })
  )
  async uploadMedia(
    @Param('companySlug') companySlug: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto
  ) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }

    const { companyId, organizationId } = await this._resolveCompany(companySlug);

    this.logger.log(
      `Media upload: companySlug=${companySlug} companyId=${companyId} file=${file.originalname}`
    );

    return this._companyMediaService.uploadAndRecord(companyId, organizationId, file, dto);
  }

  /**
   * GET /companies/:companySlug/media
   *
   * Returns paginated list of company-scoped media.
   * Query params: page, limit, tag (optional filter).
   */
  @Get()
  async listMedia(
    @Param('companySlug') companySlug: string,
    @Query() query: ListMediaQueryDto
  ) {
    const { companyId } = await this._resolveCompany(companySlug);
    return this._companyMediaService.listMedia(companyId, query);
  }

  /**
   * GET /companies/:companySlug/media/:mediaId
   *
   * Returns a single media record with its variants.
   */
  @Get(':mediaId')
  async getMedia(
    @Param('companySlug') companySlug: string,
    @Param('mediaId') mediaId: string
  ) {
    await this._resolveCompany(companySlug); // validate slug is valid
    const media = await this._companyMediaService.getMedia(mediaId);

    if (!media) {
      throw new HttpException(`Media ${mediaId} not found`, HttpStatus.NOT_FOUND);
    }

    return media;
  }

  /**
   * DELETE /companies/:companySlug/media/:mediaId
   *
   * Soft-deletes a media record (sets deletedAt).
   */
  @Delete(':mediaId')
  async deleteMedia(
    @Param('companySlug') companySlug: string,
    @Param('mediaId') mediaId: string
  ) {
    await this._resolveCompany(companySlug); // validate slug is valid
    return this._companyMediaService.deleteMedia(mediaId);
  }

  /**
   * POST /companies/:companySlug/media/:mediaId/process
   *
   * Queue asynchronous variant generation for specified platforms.
   * Body: { platforms: string[] }
   * Returns: { jobId: string, status: 'queued' }
   */
  @Post(':mediaId/process')
  async triggerVariantGeneration(
    @Param('companySlug') companySlug: string,
    @Param('mediaId') mediaId: string,
    @Body('platforms') platforms: string[]
  ) {
    if (!platforms || platforms.length === 0) {
      throw new HttpException(
        'platforms array is required and must not be empty',
        HttpStatus.BAD_REQUEST
      );
    }

    await this._resolveCompany(companySlug); // validate slug is valid
    const job = await this._companyMediaService.queueVariantGeneration(mediaId, platforms);

    return {
      jobId: job.id,
      status: 'queued' as const,
    };
  }

  // -------------------------------------------------------------------------
  // Uppy S3 Multipart endpoints
  // Used by libraries/react-shared-libraries/src/helpers/uppy.upload.ts 's3' case
  // fetchUploadApiEndpoint calls /companies/:companySlug/media/multipart/:endpoint
  // -------------------------------------------------------------------------

  /**
   * POST /companies/:companySlug/media/multipart/create-multipart-upload
   *
   * Initiates a multipart upload in MinIO and returns { uploadId, key }.
   */
  @Post('multipart/create-multipart-upload')
  async multipartCreateUpload(
    @Param('companySlug') companySlug: string,
    @Body('file') file: any,
    @Body('fileHash') fileHash: string,
    @Body('contentType') contentType: string
  ) {
    await this._resolveCompany(companySlug);
    const { makeId } = await import('@gitroom/nestjs-libraries/services/make.is');
    const ext = file?.name ? file.name.split('.').pop() || 'bin' : 'bin';
    const key = `${makeId(20)}.${ext}`;
    return this._minioStorage.createMultipartUpload(key, contentType || 'application/octet-stream');
  }

  /**
   * POST /companies/:companySlug/media/multipart/list-parts
   *
   * Lists already-uploaded parts for a multipart upload.
   */
  @Post('multipart/list-parts')
  async multipartListParts(
    @Param('companySlug') companySlug: string,
    @Body('key') key: string,
    @Body('uploadId') uploadId: string
  ) {
    await this._resolveCompany(companySlug);
    return this._minioStorage.listParts(key, uploadId);
  }

  /**
   * POST /companies/:companySlug/media/multipart/sign-part
   *
   * Returns a presigned URL to upload a single part.
   */
  @Post('multipart/sign-part')
  async multipartSignPart(
    @Param('companySlug') companySlug: string,
    @Body('key') key: string,
    @Body('uploadId') uploadId: string,
    @Body('partNumber') partNumber: number
  ) {
    await this._resolveCompany(companySlug);
    return this._minioStorage.signPart(key, uploadId, partNumber);
  }

  /**
   * POST /companies/:companySlug/media/multipart/abort-multipart-upload
   *
   * Aborts a multipart upload and frees uploaded parts.
   */
  @Post('multipart/abort-multipart-upload')
  async multipartAbortUpload(
    @Param('companySlug') companySlug: string,
    @Body('key') key: string,
    @Body('uploadId') uploadId: string
  ) {
    await this._resolveCompany(companySlug);
    return this._minioStorage.abortMultipartUpload(key, uploadId);
  }

  /**
   * POST /companies/:companySlug/media/multipart/complete-multipart-upload
   *
   * Completes the multipart upload, assembles the object in MinIO.
   * Returns the public URL as { location }.
   */
  @Post('multipart/complete-multipart-upload')
  async multipartCompleteUpload(
    @Param('companySlug') companySlug: string,
    @Body('key') key: string,
    @Body('uploadId') uploadId: string,
    @Body('parts') parts: Array<{ PartNumber: number; ETag: string }>
  ) {
    await this._resolveCompany(companySlug);
    return this._minioStorage.completeMultipartUpload(key, uploadId, parts);
  }

  /**
   * Resolve a company slug to companyId and organizationId.
   * Throws 404 if company not found.
   *
   * This follows the controller slug resolution pattern established in Phase 1:
   * controllers resolve slugs, services work with IDs only.
   */
  private async _resolveCompany(
    companySlug: string
  ): Promise<{ companyId: string; organizationId: string }> {
    const company = await (this._prisma as any).company.findUnique({
      where: { slug: companySlug },
      include: {
        organizations: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!company) {
      throw new HttpException(
        `Company with slug '${companySlug}' not found`,
        HttpStatus.NOT_FOUND
      );
    }

    const organizationId = company.organizations?.[0]?.id ?? '';

    return { companyId: company.id, organizationId };
  }
}
