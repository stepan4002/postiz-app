import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

/** CLS key used to store and retrieve the current request's company ID */
export const CLS_COMPANY_ID = 'companyId';

/** CLS key used to store and retrieve the current request's company slug */
export const CLS_COMPANY_SLUG = 'companySlug';

/**
 * Middleware that extracts the company slug from the incoming request and
 * resolves it to a company ID, then stores both in CLS for downstream use.
 *
 * Slug resolution order:
 * 1. Route param: `req.params.companySlug`
 * 2. Request header: `x-company-slug` (for API clients that don't use URL routing)
 *
 * Behaviour:
 * - Slug found and company exists in DB → sets CLS companyId + companySlug
 * - Slug found but company not in DB → returns 404 { error: "Company not found" }
 * - No slug provided → passes through (non-company routes continue normally)
 *
 * IMPORTANT: This middleware uses the raw PrismaService (not the scoped client)
 * for the company lookup — this is the bootstrap query that resolves which
 * company is active. The scoped client is created AFTER this middleware runs.
 */
@Injectable()
export class CompanyContextMiddleware implements NestMiddleware {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Resolve slug from route param or header
    const slug: string | undefined =
      (req.params as Record<string, string>)['companySlug'] ||
      (req.headers['x-company-slug'] as string | undefined);

    // No slug — non-company route, continue without context
    if (!slug) {
      return next();
    }

    // Look up company by slug (raw prisma, not scoped — this is the bootstrap query).
    // Cast to any: the Company model is added in Phase 1 Plan 02 migration;
    // prisma generate must be re-run after the migration to update the client types.
    // At runtime this works correctly once the migration is applied.
    const company = await (this.prisma as any).company.findUnique({
      where: { slug },
      select: { id: true, slug: true },
    });

    if (!company) {
      res.status(HttpStatus.NOT_FOUND).json({ error: 'Company not found' });
      return;
    }

    // Store company context in CLS for the duration of this request
    this.cls.set(CLS_COMPANY_ID, company.id);
    this.cls.set(CLS_COMPANY_SLUG, company.slug);

    return next();
  }
}
