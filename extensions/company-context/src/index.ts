// @social/company-context — Public API
// Company context NestJS module: Prisma $extends factory and CLS middleware for per-request company scoping.
// Phase 1, Plan 02 implementation.

export { CompanyContextModule, COMPANY_PRISMA } from './company-context.module';
export {
  CompanyContextMiddleware,
  CLS_COMPANY_ID,
  CLS_COMPANY_SLUG,
} from './company-context.middleware';
export {
  prismaWithCompany,
  isCompanyOwned,
} from './prisma-company.factory';
export type { ScopedPrismaClient } from './prisma-company.factory';
