import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportService } from './report.service';

/**
 * ReportCronJob — Generates weekly (Sunday midnight) and monthly (1st of month) reports.
 */
@Injectable()
export class ReportCronJob {
  constructor(
    private readonly reportService: ReportService,
    private readonly prisma: any,
  ) {}

  // Every Sunday at midnight
  @Cron('0 0 * * 0')
  async generateWeeklyReports() {
    if (process.env.RUN_CRON !== 'true') return;

    try {
      const companies = await this.prisma.company.findMany({ select: { id: true, name: true } });
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodStart.getDate() - 7);

      for (const company of companies) {
        try {
          await this.reportService.generateReport(company.id, 'weekly', periodStart, periodEnd);
          console.log(`[ReportCron] Weekly report generated for ${company.name}`);
        } catch (err) {
          console.error(`[ReportCron] Weekly report error for ${company.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[ReportCron] Fatal error in weekly reports:', err);
    }
  }

  // 1st of every month at 1am
  @Cron('0 1 1 * *')
  async generateMonthlyReports() {
    if (process.env.RUN_CRON !== 'true') return;

    try {
      const companies = await this.prisma.company.findMany({ select: { id: true, name: true } });
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setMonth(periodStart.getMonth() - 1);

      for (const company of companies) {
        try {
          await this.reportService.generateReport(company.id, 'monthly', periodStart, periodEnd);
          console.log(`[ReportCron] Monthly report generated for ${company.name}`);
        } catch (err) {
          console.error(`[ReportCron] Monthly report error for ${company.id}:`, err);
        }
      }
    } catch (err) {
      console.error('[ReportCron] Fatal error in monthly reports:', err);
    }
  }
}
