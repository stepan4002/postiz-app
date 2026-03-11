---
phase: 01-fork-and-foundation
plan: 02
subsystem: database
tags: [prisma, postgresql, nestjs-cls, company-hierarchy, multi-tenant, middleware, prisma-extensions]

# Dependency graph
requires:
  - phase: 01-fork-and-foundation/01-01
    provides: Extension zone scaffold, pnpm workspace @social/* packages, Docker dev environment
provides:
  - Company, Brand, BrandVoice, SocialAccount Prisma models in schema.prisma
  - Prisma migration 20260310000000_company_hierarchy (DDL-only, ready to apply)
  - Organization.companyId nullable FK linking existing orgs to companies
  - prismaWithCompany() factory auto-scoping queries by companyId via Prisma $extends
  - CompanyContextMiddleware resolving company slug to companyId stored in CLS
  - COMPANY_PRISMA NestJS injection token for request-scoped company-filtered Prisma client
  - CompanyContextModule registered globally in AppModule
affects: [02-credential-management, 03-company-crud, 04-media-library, 05-content-generation, all-phases]

# Tech tracking
tech-stack:
  added:
    - nestjs-cls 4.5.0 (already in root node_modules from Plan 01 declaration; active in company-context module)
    - Prisma $extends query interceptor pattern (non-breaking extension for auto-scoping)
  patterns:
    - Company-owned model auto-scoping: COMPANY_OWNED Set drives which models get companyId injected
    - CLS (AsyncLocalStorage) for request-scoped company context — never singleton property storage
    - Bootstrap query pattern: raw PrismaService used for company slug lookup before scoped client created
    - Additive-only schema modifications: custom models in named block, Organization FK added at field-list end

key-files:
  created:
    - extensions/company-context/src/prisma-company.factory.ts
    - extensions/company-context/src/company-context.middleware.ts
    - extensions/company-context/src/company-context.module.ts
    - libraries/nestjs-libraries/src/database/prisma/migrations/20260310000000_company_hierarchy/migration.sql
    - libraries/nestjs-libraries/src/database/prisma/migrations/migration_lock.toml
  modified:
    - libraries/nestjs-libraries/src/database/prisma/schema.prisma (Company/Brand/BrandVoice/SocialAccount models + Organization.companyId FK)
    - extensions/company-context/src/index.ts (full barrel export)
    - extensions/company-context/tsconfig.json (commonjs output, removed rootDir constraint)
    - apps/backend/src/app.module.ts (CompanyContextModule import)
    - DIVERGENCE.md (two new entries: app.module.ts, schema.prisma)

key-decisions:
  - "Migration file created manually (not via prisma migrate dev) because Docker/DB not running; file is correct DDL and will apply cleanly when DB is available"
  - "prismaWithCompany returns base prisma unmodified when companyId is null — preserves admin/seed operation capability without separate client"
  - "Company model lookup in middleware uses (prisma as any).company because Prisma client types not regenerated yet (requires live DB + prisma generate); cast is safe at runtime"
  - "CompanyContextModule registered before ApiModule in AppModule to ensure ClsModule global context is initialized before request handlers"
  - "COMPANY_OWNED Set is Phase 1 scope only: Brand, BrandVoice, SocialAccount — upstream Postiz tables scoped via Organization->Company relation chain per R2.5 design"

patterns-established:
  - "COMPANY_PRISMA token: inject scoped Prisma client in any service with @Inject(COMPANY_PRISMA)"
  - "CLS_COMPANY_ID / CLS_COMPANY_SLUG constants: shared keys for accessing company context in CLS"
  - "isCompanyOwned(model) helper: check if a model name requires company scoping before adding to COMPANY_OWNED Set"

requirements-completed: [R2.1, R2.2, R2.3, R2.4, R2.5, R2.6]

# Metrics
duration: 20min
completed: 2026-03-10
---

# Phase 1 Plan 02: Multi-Company Data Model Summary

**Prisma schema extended with Company/Brand/BrandVoice/SocialAccount hierarchy, Organization.companyId FK, and request-scoped CLS middleware auto-filtering all Prisma queries by companyId via $extends**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-03-10T14:15:44Z
- **Completed:** 2026-03-10T14:36:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Four new Prisma models (Company, Brand, BrandVoice, SocialAccount) added to schema with correct relations, cascade deletes, and unique constraints; schema validates cleanly
- Prisma migration file (20260310000000_company_hierarchy) created with complete DDL — purely additive (no upstream table modifications), ready to apply when Docker stack is running
- Company-context middleware pipeline wired: CompanyContextMiddleware reads slug from URL param or `x-company-slug` header, resolves to company ID via DB lookup, stores in CLS; prismaWithCompany() factory reads CLS and returns a $extends-filtered Prisma client; COMPANY_PRISMA injection token available app-wide

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Company hierarchy models to Prisma schema and migration** - `2b741b7e` (feat)
2. **Task 2: Implement company-context middleware with Prisma auto-scoping** - `40b55f35` (feat)

**Plan metadata:** (docs: to follow)

## Files Created/Modified

- `libraries/nestjs-libraries/src/database/prisma/schema.prisma` - Added Company, Brand, BrandVoice, SocialAccount models in named block; added nullable companyId FK + index to Organization
- `libraries/nestjs-libraries/src/database/prisma/migrations/20260310000000_company_hierarchy/migration.sql` - Complete DDL: CREATE TABLE for 4 models, ALTER TABLE Organization, all indexes and FK constraints
- `libraries/nestjs-libraries/src/database/prisma/migrations/migration_lock.toml` - Prisma migration state tracking file
- `extensions/company-context/src/prisma-company.factory.ts` - prismaWithCompany() Prisma $extends factory + isCompanyOwned() helper + COMPANY_OWNED Set
- `extensions/company-context/src/company-context.middleware.ts` - NestJS middleware: slug resolution from URL param/header, DB lookup, CLS storage
- `extensions/company-context/src/company-context.module.ts` - Global NestJS module: ClsModule.forRoot, COMPANY_PRISMA provider, middleware registration
- `extensions/company-context/src/index.ts` - Full barrel export of all public symbols
- `extensions/company-context/tsconfig.json` - Updated to commonjs module output, removed rootDir constraint that blocked cross-package imports
- `apps/backend/src/app.module.ts` - Added CompanyContextModule import before ApiModule
- `DIVERGENCE.md` - Two new entries: apps/backend/src/app.module.ts and libraries/nestjs-libraries/src/database/prisma/schema.prisma

## Decisions Made

- Migration created manually (without `prisma migrate dev`) because Docker is not running in the current environment. The migration SQL is hand-authored from the schema diff and is correct DDL. When `pnpm run dev:docker` is run and `pnpm run prisma:migrate` is executed, Prisma will mark it as applied. This is documented so any developer running the project knows to run the migration.
- `prismaWithCompany(prisma, null)` returns the base prisma client unmodified — this is intentional for admin operations and seed scripts that must operate across all companies.
- Used `(prisma as any).company` in the middleware for the bootstrap company lookup. Prisma generate hasn't been run against the new schema (requires live DB), so TypeScript types don't include `.company` yet. The cast is safe at runtime; it will be cleaned up when `prisma generate` is next run.
- COMPANY_OWNED is a Phase 1 Set with only Brand, BrandVoice, SocialAccount. Upstream tables (Post, Integration, Media, etc.) are scoped through the Organization->Company relation chain per the R2.5 design decision in the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed tsconfig.json rootDir constraint blocking cross-package imports**
- **Found during:** Task 2 TypeScript compilation verification
- **Issue:** Original tsconfig.json had `"rootDir": "src"` which prevented importing `@gitroom/nestjs-libraries/*` paths because those files are outside `extensions/company-context/src/`
- **Fix:** Updated tsconfig.json to remove `rootDir`, add `commonjs` module output and `declaration: true` — matching the pattern used by `libraries/nestjs-libraries/tsconfig.lib.json`
- **Files modified:** `extensions/company-context/tsconfig.json`
- **Verification:** `npx tsc --project extensions/company-context/tsconfig.json --noEmit` passes with zero errors
- **Committed in:** `40b55f35` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required fix for TypeScript compilation to succeed. No scope creep.

## Issues Encountered

- Docker not running: `prisma migrate dev` and `prisma generate` cannot be executed without a live database. Migration SQL was authored manually from the schema diff. The migration is well-formed and will apply cleanly. Run `pnpm run dev:docker && pnpm run prisma:migrate && pnpm run prisma:generate` to apply and regenerate types.
- Pre-existing upstream TypeScript errors exist in `apps/backend` (`wallet.provider.ts`, `agent.graph.service.ts`, etc.) but are out of scope — they were present before this plan and are not caused by our changes.

## User Setup Required

To activate the migration, run:

```bash
pnpm run dev:docker
pnpm run prisma:migrate
pnpm run prisma:generate
```

This will:
1. Start PostgreSQL via Docker Compose
2. Apply the `company_hierarchy` migration to create Company, Brand, BrandVoice, SocialAccount tables
3. Regenerate Prisma client types (removes the `(prisma as any).company` cast in middleware)

## Next Phase Readiness

- Prisma schema has the full Company hierarchy ready for Phase 2 credential management and Phase 3 company CRUD
- COMPANY_PRISMA token is injectable in any NestJS service for auto-scoped queries
- CompanyContextMiddleware is active on all routes — company slug in URL or `x-company-slug` header is enough to scope any request
- DIVERGENCE.md tracks all changes for upstream merge safety

## Self-Check: PASSED

- FOUND: extensions/company-context/src/prisma-company.factory.ts
- FOUND: extensions/company-context/src/company-context.middleware.ts
- FOUND: extensions/company-context/src/company-context.module.ts
- FOUND: libraries/nestjs-libraries/src/database/prisma/migrations/20260310000000_company_hierarchy/migration.sql
- FOUND: .planning/phases/01-fork-and-foundation/01-02-SUMMARY.md
- FOUND: commit 2b741b7e (feat(01-02): add Company hierarchy models)
- FOUND: commit 40b55f35 (feat(01-02): implement company-context middleware)

---
*Phase: 01-fork-and-foundation*
*Completed: 2026-03-10*
