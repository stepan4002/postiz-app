/**
 * AyrShareLogRepository
 *
 * Prisma data layer for AyrShareLog records.
 * Tracks every AyrShare API call for auditing, debugging, and webhook correlation.
 *
 * Table: AyrShareLog
 *
 * Status lifecycle:
 *   pending → success | failed
 *   (No polling needed — AyrShare uses webhooks for async status updates)
 */

import { Injectable } from '@nestjs/common';

@Injectable()
export class AyrShareLogRepository {
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
    method?: string;
    requestPayload: Record<string, any>;
    responseCode?: number;
    responseBody?: Record<string, any>;
    ayrsharePostId?: string;
    status?: string;
    errorMessage?: string;
  }) {
    return this.prisma.ayrShareLog.create({
      data: {
        profileId: data.profileId,
        postVariantId: data.postVariantId || null,
        endpoint: data.endpoint,
        method: data.method || 'POST',
        requestPayload: data.requestPayload,
        responseCode: data.responseCode || null,
        responseBody: data.responseBody || null,
        ayrsharePostId: data.ayrsharePostId || null,
        status: data.status || 'pending',
        errorMessage: data.errorMessage || null,
      },
    });
  }

  /**
   * Find log entries by status.
   *
   * @param status - Status to filter by
   * @returns Array of log records
   */
  async findByStatus(status: string) {
    return this.prisma.ayrShareLog.findMany({
      where: { status },
      include: {
        profile: { select: { profileKey: true, organizationId: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find a log entry by AyrShare post ID (for webhook correlation).
   *
   * @param ayrsharePostId - AyrShare post ID
   * @returns Log record or null
   */
  async findByAyrsharePostId(ayrsharePostId: string) {
    return this.prisma.ayrShareLog.findFirst({
      where: { ayrsharePostId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update a log entry (e.g. after webhook arrives).
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
      ayrsharePostId: string;
      status: string;
      errorMessage: string;
    }>,
  ) {
    return this.prisma.ayrShareLog.update({
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
    return this.prisma.ayrShareLog.findMany({
      where: { profileId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
