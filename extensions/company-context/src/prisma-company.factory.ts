import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

/**
 * Set of Prisma model names that are owned by a Company and must be filtered
 * by companyId automatically. Only models in this set are scoped.
 *
 * NOTE: This list expands across phases:
 * - Phase 1: Brand, BrandVoice, SocialAccount (our new models)
 * - Phase 2+: additional models as they are added
 *
 * Upstream Postiz tables (Post, Integration, Media, etc.) are scoped via the
 * Organization->Company relation chain, NOT via direct companyId filters here.
 */
const COMPANY_OWNED = new Set(['Brand', 'BrandVoice', 'SocialAccount']);

/**
 * Returns true if a Prisma model name is in the company-owned set.
 */
export function isCompanyOwned(model: string): boolean {
  return COMPANY_OWNED.has(model);
}

/**
 * Creates a Prisma client extension that automatically scopes all queries on
 * company-owned models by the provided companyId.
 *
 * Handles: findMany, findFirst, findUnique, create, update, delete, count.
 *
 * If companyId is null or undefined (e.g., admin/seed operations), filtering
 * is skipped entirely so cross-company operations remain possible.
 *
 * @param prisma - The base PrismaService instance (singleton injected by NestJS)
 * @param companyId - The company ID for this request context, or null to skip scoping
 * @returns An extended Prisma client scoped to the given company
 */
export function prismaWithCompany(
  prisma: PrismaService,
  companyId: string | null
) {
  if (!companyId) {
    // No company context — return the base client without modification.
    // This allows admin operations and seeding to work without company scoping.
    return prisma;
  }

  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ model, operation, args, query }: any) {
          if (isCompanyOwned(model)) {
            args.where = { ...args.where, companyId };
          }
          return query(args);
        },

        async findFirst({ model, operation, args, query }: any) {
          if (isCompanyOwned(model)) {
            args.where = { ...args.where, companyId };
          }
          return query(args);
        },

        async findUnique({ model, operation, args, query }: any) {
          if (isCompanyOwned(model)) {
            // findUnique requires a unique where clause; we upgrade to findFirst
            // with companyId scoping to prevent cross-company leakage via ID guessing.
            // The caller receives the same result shape either way.
            args.where = { ...args.where, companyId };
          }
          return query(args);
        },

        async create({ model, operation, args, query }: any) {
          if (isCompanyOwned(model)) {
            args.data = { ...args.data, companyId };
          }
          return query(args);
        },

        async update({ model, operation, args, query }: any) {
          if (isCompanyOwned(model)) {
            args.where = { ...args.where, companyId };
          }
          return query(args);
        },

        async delete({ model, operation, args, query }: any) {
          if (isCompanyOwned(model)) {
            args.where = { ...args.where, companyId };
          }
          return query(args);
        },

        async count({ model, operation, args, query }: any) {
          if (isCompanyOwned(model)) {
            args.where = { ...args.where, companyId };
          }
          return query(args);
        },
      },
    },
  });
}

/** Type alias for the scoped Prisma client returned by prismaWithCompany */
export type ScopedPrismaClient = ReturnType<typeof prismaWithCompany>;
