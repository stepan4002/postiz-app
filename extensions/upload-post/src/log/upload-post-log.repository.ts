/**
 * UploadPostLogRepository
 *
 * Prisma data layer for UploadPostLog records.
 * Tracks every Upload-Post API call for auditing, debugging, and async polling.
 *
 * Table: UploadPostLog
 *
 * Status lifecycle:
 *   pending → polling → success | failed
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class UploadPostLogRepository {
  constructor(private readonly prisma: any) {}

  /**
   * Create a new log entry for an API call.
   *
   * @param data - Log entry data
   * @returns Created log record
   */
  async create(data: {
    profileId: string;
    postVariantId?: string;
    endpoint: string;
    requestPayload: Record<string, any>;
    responseCode?: number;
    responseBody?: Record<string, any>;
    requestId?: string;
    jobId?: string;
    status?: string;
    errorMessage?: string;
  }) {
    return this.prisma.uploadPostLog.create({
      data: {
        profileId: data.profileId,
        postVariantId: data.postVariantId || null,
        endpoint: data.endpoint,
        requestPayload: data.requestPayload,
        responseCode: data.responseCode || null,
        responseBody: data.responseBody || null,
        requestId: data.requestId || null,
        jobId: data.jobId || null,
        status: data.status || 'pending',
        errorMessage: data.errorMessage || null,
      },
    });
  }

  /**
   * Find all log entries with "polling" status (for async status sync cron).
   *
   * @returns Array of log records that need status polling
   */
  async findByStatus(status: string) {
    return this.prisma.uploadPostLog.findMany({
      where: { status },
      include: {
        profile: { select: { profileUsername: true, organizationId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Update a log entry (e.g. after polling completes).
   *
   * @param id - Log record ID
   * @param data - Fields to update
   * @returns Updated log record
   */
  async update(
    id: string,
    data: Partial<{
      responseCode: number;
      responseBody: Record<string, any>;
      status: string;
      errorMessage: string;
    }>,
  ) {
    return this.prisma.uploadPostLog.update({
      where: { id },
      data,
    });
  }

  /**
   * Find recent log entries for a profile (for debugging UI).
   *
   * @param profileId - Profile record ID
   * @param limit - Max entries to return (default: 50)
   * @returns Array of log records, newest first
   */
  async findByProfile(profileId: string, limit = 50) {
    return this.prisma.uploadPostLog.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
