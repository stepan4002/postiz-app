import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ReportService } from './report.service';

/**
 * ReportController — REST endpoints for company report summaries.
 */
@Controller()
export class ReportController {
  private prisma: any;

  constructor(private readonly reportService: ReportService) {}

  /**
   * GET /companies/:companySlug/reports
   */
  @Get('companies/:companySlug/reports')
  async getReports(
    @Param('companySlug') companySlug: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);
    return this.reportService.getReports(
      companyId,
      type,
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 10,
    );
  }

  /**
   * GET /companies/:companySlug/reports/:reportId
   */
  @Get('companies/:companySlug/reports/:reportId')
  async getReport(
    @Param('companySlug') companySlug: string,
    @Param('reportId') reportId: string,
  ) {
    const companyId = await this.resolveCompanyId(companySlug);
    const report = await this.reportService.getReport(reportId, companyId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }

  /**
   * Called by the module factory to inject PrismaService for slug resolution.
   */
  setPrisma(prisma: any) {
    this.prisma = prisma;
  }

  private async resolveCompanyId(slug: string): Promise<string> {
    if (!this.prisma) {
      // Fallback: assume slug is the id
      return slug;
    }
    const company = await this.prisma.company.findFirst({
      where: { OR: [{ id: slug }, { name: slug }] },
      select: { id: true },
    });
    if (!company) throw new NotFoundException(`Company not found: ${slug}`);
    return company.id;
  }
}
