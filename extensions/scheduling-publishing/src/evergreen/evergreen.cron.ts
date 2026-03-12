import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EvergreenService } from './evergreen.service';

/**
 * EvergreenRecyclingJob — Daily cron that finds recyclable evergreen posts
 * and logs them for scheduling. Actual auto-scheduling depends on posting rules.
 */
@Injectable()
export class EvergreenRecyclingJob {
  constructor(
    private readonly evergreenService: EvergreenService,
    private readonly prisma: any,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handleEvergreenRecycling() {
    if (process.env.RUN_CRON !== 'true') return;

    try {
      // Get all companies
      const companies = await this.prisma.company.findMany({
        select: { id: true, name: true },
      });

      for (const company of companies) {
        try {
          const recyclable = await this.evergreenService.findRecyclablePosts(
            company.id,
            30, // minimum 30 days since last recycle
            5,  // max 5 posts per company per day
          );

          if (recyclable.length > 0) {
            console.log(
              `[EvergreenRecycling] Company ${company.name}: ${recyclable.length} posts eligible for recycling`,
            );
          }
          // Note: Actual draft creation would integrate with posting rules slot finder.
          // For now, just mark them as candidates.
        } catch (err) {
          console.error(`[EvergreenRecycling] Error for company ${company.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[EvergreenRecycling] Fatal error:', err);
    }
  }
}
