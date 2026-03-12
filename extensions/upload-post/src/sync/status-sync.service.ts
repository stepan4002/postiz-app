/**
 * StatusSyncService
 *
 * Polls Upload-Post API for async post results.
 *
 * When Upload-Post returns a request_id instead of immediate results,
 * this cron job polls /api/status/{request_id} every minute until the
 * post completes or fails (or times out after 1 hour).
 *
 * Runs every minute via @Cron. Only processes logs with status = "polling".
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UploadPostClient } from '../client/upload-post.client';
import { UploadPostLogRepository } from '../log/upload-post-log.repository';
import { UploadPostConfigRepository } from '../config/upload-post-config.repository';

@Injectable()
export class StatusSyncService {
  private readonly logger = new Logger(StatusSyncService.name);

  constructor(
    private readonly logRepository: UploadPostLogRepository,
    private readonly configRepository: UploadPostConfigRepository,
  ) {}

  /**
   * Poll pending Upload-Post requests for completion.
   *
   * Flow:
   * 1. Find all log entries with status = "polling"
   * 2. For each, fetch the org's API key and check status via Upload-Post API
   * 3. Update log entry with results
   * 4. Time out after 1 hour
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async pollPendingPosts() {
    const pendingLogs = await this.logRepository.findByStatus('polling');

    if (pendingLogs.length === 0) {
      return; // Nothing to poll — skip silently
    }

    this.logger.log(`pollPendingPosts: checking ${pendingLogs.length} pending requests`);

    for (const log of pendingLogs) {
      try {
        // Check if this log entry has timed out (> 1 hour old)
        const ageMs = Date.now() - new Date(log.createdAt).getTime();
        const ONE_HOUR = 60 * 60 * 1000;

        if (ageMs > ONE_HOUR) {
          this.logger.warn(`pollPendingPosts: request ${log.requestId} timed out after 1 hour`);
          await this.logRepository.update(log.id, {
            status: 'failed',
            errorMessage: 'Polling timeout: no response after 1 hour',
          });
          continue;
        }

        // Get API key for this org
        const config = await this.configRepository.findByOrganizationId(
          log.profile.organizationId,
        );

        if (!config) {
          this.logger.warn(
            `pollPendingPosts: no config for org ${log.profile.organizationId}, marking failed`,
          );
          await this.logRepository.update(log.id, {
            status: 'failed',
            errorMessage: 'Upload-Post config deleted while post was pending',
          });
          continue;
        }

        // Poll Upload-Post API
        const client = new UploadPostClient(config.apiKey);
        const status = await client.checkStatus(log.requestId!);

        if (status.completed) {
          const allSucceeded = status.results?.every((r) => r.success) ?? false;
          await this.logRepository.update(log.id, {
            status: allSucceeded ? 'success' : 'failed',
            responseBody: status as any,
            errorMessage: allSucceeded ? null : 'One or more platforms failed',
          });

          this.logger.log(
            `pollPendingPosts: request ${log.requestId} completed — ${allSucceeded ? 'success' : 'partial failure'}`,
          );
        } else if (status.status === 'failed') {
          await this.logRepository.update(log.id, {
            status: 'failed',
            responseBody: status as any,
            errorMessage: status.error || 'Upload-Post reported failure',
          });

          this.logger.warn(`pollPendingPosts: request ${log.requestId} failed: ${status.error}`);
        }
        // If still processing, leave status as "polling" and check next minute
      } catch (err: any) {
        this.logger.error(
          `pollPendingPosts: error polling request ${log.requestId}: ${err?.message}`,
        );
        // Don't mark as failed on transient errors — will retry next minute
      }
    }
  }
}
