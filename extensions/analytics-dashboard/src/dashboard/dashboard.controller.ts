// SOCIAL COMMAND CENTRE — Phase 7: Analytics & Dashboard
// DashboardController: GET /dashboard endpoint serving pre-computed cache data

import { Controller, Get, Query, Param, NotFoundException } from '@nestjs/common';
import { DashboardService, FullDashboardData } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * GET /dashboard?companySlug=:slug
   *
   * Returns pre-computed dashboard data from DashboardCache.
   * - If companySlug is 'all' or omitted: returns cross-company aggregate (R12.6)
   * - If companySlug provided: resolves to companyId, returns per-company cache
   * - Returns 404 if companySlug provided but company not found
   *
   * NF3.1: Reads from single DashboardCache row — sub-2s page load achievable.
   */
  @Get()
  async getDashboard(
    @Query('companySlug') companySlug?: string,
  ): Promise<FullDashboardData> {
    // No slug or explicit 'all' → cross-company aggregation (R12.6)
    if (!companySlug || companySlug === 'all') {
      return this.dashboardService.getDashboardAllCompanies();
    }

    const companyId = await this.dashboardService.resolveCompanyId(companySlug);
    if (!companyId) {
      throw new NotFoundException(
        `Company with slug '${companySlug}' not found`,
      );
    }

    return this.dashboardService.getDashboard(companyId);
  }

  /**
   * GET /dashboard/companies/:slug
   *
   * Company-specific endpoint with cleaner URL structure.
   * Resolves company slug to ID and returns pre-computed dashboard data.
   * Returns 404 if company not found.
   */
  @Get('companies/:slug')
  async getDashboardByCompanySlug(
    @Param('slug') slug: string,
  ): Promise<FullDashboardData> {
    const companyId = await this.dashboardService.resolveCompanyId(slug);
    if (!companyId) {
      throw new NotFoundException(`Company with slug '${slug}' not found`);
    }

    return this.dashboardService.getDashboard(companyId);
  }
}
