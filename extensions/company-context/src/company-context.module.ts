import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ClsModule, ClsService } from 'nestjs-cls';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  CompanyContextMiddleware,
  CLS_COMPANY_ID,
} from './company-context.middleware';
import { prismaWithCompany } from './prisma-company.factory';

/**
 * Injection token for the company-scoped Prisma client.
 *
 * Usage in other modules/services:
 * ```ts
 * @Inject(COMPANY_PRISMA)
 * private readonly prisma: ScopedPrismaClient;
 * ```
 */
export const COMPANY_PRISMA = 'COMPANY_PRISMA';

/**
 * CompanyContextModule wires together:
 * - ClsModule (global, auto-mounted): provides request-scoped storage via AsyncLocalStorage
 * - CompanyContextMiddleware: extracts company slug from request, resolves to ID, stores in CLS
 * - COMPANY_PRISMA provider: creates a request-scoped Prisma client that auto-filters by companyId
 *
 * This module is @Global so COMPANY_PRISMA is available throughout the app without
 * re-importing CompanyContextModule in every feature module.
 *
 * The COMPANY_PRISMA provider is REQUEST-scoped so a fresh scoped client is created
 * per request with the correct companyId from CLS.
 */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        // Auto-mount CLS middleware on all routes so AsyncLocalStorage context
        // is always available. CompanyContextMiddleware runs after this and
        // populates the company fields.
        mount: true,
      },
    }),
  ],
  providers: [
    CompanyContextMiddleware,
    {
      provide: COMPANY_PRISMA,
      useFactory: (prisma: PrismaService, cls: ClsService) => {
        // Read companyId from CLS for this request context.
        // Returns null if not set (non-company routes or admin operations).
        const companyId = cls.get<string | null>(CLS_COMPANY_ID) ?? null;
        return prismaWithCompany(prisma, companyId);
      },
      inject: [PrismaService, ClsService],
    },
  ],
  exports: [COMPANY_PRISMA, CompanyContextMiddleware],
})
export class CompanyContextModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Apply CompanyContextMiddleware to all routes.
    // It is a no-op for routes without a company slug, so this is safe globally.
    consumer.apply(CompanyContextMiddleware).forRoutes('*');
  }
}
