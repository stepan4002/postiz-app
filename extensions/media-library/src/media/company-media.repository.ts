/**
 * CompanyMediaRepository
 *
 * Prisma DB layer for company-scoped media queries.
 * All queries are scoped by companyId — Company A cannot see Company B media.
 *
 * Pattern follows existing MediaRepository in:
 * libraries/nestjs-libraries/src/database/prisma/media/media.repository.ts
 */
import { Injectable } from '@nestjs/common';

export interface CreateMediaData {
  name: string;
  path: string;
  thumbnail: string;
  organizationId: string;
  companyId: string;
  fileSize: number;
  type: string;
  width?: number;
  height?: number;
  format?: string;
  tags?: string[];
  alt?: string;
}

export interface PaginatedMediaResult {
  items: any[];
  total: number;
  page: number;
  totalPages: number;
}

@Injectable()
export class CompanyMediaRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Insert a new Media record with all metadata including company scoping.
   */
  createMedia(data: CreateMediaData) {
    return this.prisma.media.create({
      data: {
        name: data.name,
        path: data.path,
        thumbnail: data.thumbnail,
        organizationId: data.organizationId,
        companyId: data.companyId,
        fileSize: data.fileSize,
        type: data.type,
        width: data.width ?? null,
        height: data.height ?? null,
        format: data.format ?? null,
        tags: data.tags ?? [],
        alt: data.alt ?? null,
      },
    });
  }

  /**
   * Return paginated media for a company.
   * Filters by companyId, excludes soft-deleted records.
   * Optionally filters by tag using Prisma `has` (PostgreSQL array contains).
   *
   * ISOLATION CONTRACT: companyId filter ensures Company A never sees Company B data.
   */
  async findByCompany(
    companyId: string,
    page: number,
    limit: number,
    tag?: string
  ): Promise<PaginatedMediaResult> {
    const skip = (page - 1) * limit;

    const where: any = {
      companyId,
      deletedAt: null,
    };

    if (tag) {
      where.tags = { has: tag };
    }

    const [items, total] = await Promise.all([
      this.prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.media.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a single media record by ID, including its variants relation.
   */
  findById(id: string) {
    return this.prisma.media.findUnique({
      where: { id },
      include: { variants: true },
    });
  }

  /**
   * Soft-delete a media record by setting deletedAt timestamp.
   */
  deleteMedia(id: string) {
    return this.prisma.media.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Create a MediaProcessingJob to queue async variant generation.
   * Status starts as 'pending' — picked up by the media processing cron job (Plan 03).
   */
  createProcessingJob(mediaId: string, platforms: string[]) {
    return this.prisma.mediaProcessingJob.create({
      data: {
        mediaId,
        platforms,
        status: 'pending',
      },
    });
  }

  /**
   * Fetch pending processing jobs for the cron worker (Plan 03).
   */
  findPendingProcessingJobs(limit: number) {
    return this.prisma.mediaProcessingJob.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Mark a processing job as 'processing' (atomic update for worker lease).
   */
  markJobProcessing(jobId: string) {
    return this.prisma.mediaProcessingJob.update({
      where: { id: jobId },
      data: { status: 'processing' },
    });
  }

  /**
   * Mark a processing job as completed.
   */
  markJobCompleted(jobId: string) {
    return this.prisma.mediaProcessingJob.update({
      where: { id: jobId },
      data: { status: 'completed' },
    });
  }

  /**
   * Mark a processing job as failed with an error message.
   */
  markJobFailed(jobId: string, error: string) {
    return this.prisma.mediaProcessingJob.update({
      where: { id: jobId },
      data: { status: 'failed', error },
    });
  }
}
