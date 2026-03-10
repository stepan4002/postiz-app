---
phase: 01-fork-and-foundation
plan: 03
subsystem: api
tags: [nestjs, prisma, crud, rest-api, company, brand, brand-voice, seed]

# Dependency graph
requires:
  - phase: 01-fork-and-foundation/01-02
    provides: Company/Brand/BrandVoice/SocialAccount Prisma models, prismaWithCompany factory, CompanyContextModule
provides:
  - CompanyService: findAll, findBySlug, findById, create, update, delete
  - BrandService: findAllByCompany, findBySlug, create, update, delete (scoped by companyId parameter)
  - BrandVoiceService: findByBrand, upsert (1:1 with Brand)
  - REST API at /api/companies (Company CRUD)
  - REST API at /api/companies/:companySlug/brands (Brand CRUD)
  - REST API at /api/companies/:companySlug/brands/:brandSlug/voice (BrandVoice upsert)
  - MultiCompanyModule registered in AppModule
  - Idempotent seed script with 3 companies (Verde Kitchen, Nexus AI, Aura Fashion)
affects: [04-isolation-tests, 02-credential-management, all-phases]

# Tech tracking
tech-stack:
  added:
    - class-validator (already present in package.json; active in DTOs)
    - class-transformer (already present; used for DTO transformation)
  patterns:
    - Explicit companyId parameter scoping: BrandService receives companyId as parameter, not from CLS — keeps services testable
    - Controller resolves slug to entity: controllers resolve companySlug/brandSlug to IDs, pass IDs to services
    - Prisma $any cast pattern: (prisma as any).company.findMany() — safe until prisma generate runs against live DB

key-files:
  created:
    - extensions/multi-company/src/company/company.service.ts
    - extensions/multi-company/src/company/company.controller.ts
    - extensions/multi-company/src/company/company.module.ts
    - extensions/multi-company/src/company/dto/create-company.dto.ts
    - extensions/multi-company/src/company/dto/update-company.dto.ts
    - extensions/multi-company/src/brand/brand.service.ts
    - extensions/multi-company/src/brand/brand.controller.ts
    - extensions/multi-company/src/brand/brand.module.ts
    - extensions/multi-company/src/brand/dto/create-brand.dto.ts
    - extensions/multi-company/src/brand/dto/update-brand.dto.ts
    - extensions/multi-company/src/brand-voice/brand-voice.service.ts
    - extensions/multi-company/src/brand-voice/brand-voice.controller.ts
    - extensions/multi-company/src/brand-voice/brand-voice.module.ts
    - extensions/multi-company/src/brand-voice/dto/upsert-brand-voice.dto.ts
    - extensions/multi-company/src/multi-company.module.ts
    - extensions/seed/seed.ts
  modified:
    - extensions/multi-company/src/index.ts (full barrel export)
    - apps/backend/src/app.module.ts (MultiCompanyModule import)
    - DIVERGENCE.md (Plan 03 entry for app.module.ts)

key-decisions:
  - "BrandService uses explicit companyId parameter not CLS — isolation is explicit and testable without mocking CLS"
  - "Controllers resolve slugs to IDs before calling services — services deal in IDs only, simpler and more testable"
  - "Prisma cast (prisma as any) pattern used because prisma generate has not run yet (needs live DB); will be cleaned up in later phase"
  - "Seed script uses upsert on unique constraints (slug for Company, companyId+slug for Brand, brandId for BrandVoice, brandId+platform for SocialAccount)"

patterns-established:
  - "CompanyService.findBySlug/findById throw NotFoundException — controllers never 404 themselves"
  - "BrandService.create validates slug uniqueness within company before inserting"
  - "Cascade delete: deleting Company removes Brands; deleting Brand removes BrandVoice + SocialAccounts"

requirements-completed: [R2.7, R2.8]

# Metrics
duration: 25min
completed: 2026-03-10
---

# Phase 1 Plan 03: Company CRUD API Summary

**Company/Brand/BrandVoice REST CRUD API with NestJS services and DTOs, MultiCompanyModule wired into AppModule, and idempotent seed with 3 companies**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-10T14:30:01Z
- **Completed:** 2026-03-10T14:55:00Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- Company CRUD service and REST controller: GET/POST/PUT/DELETE /api/companies with slug/id resolution, conflict detection, cascade delete
- Brand CRUD service nested under company: GET/POST/PUT/DELETE /api/companies/:companySlug/brands — all operations explicitly scoped by companyId parameter (not CLS) for testability
- BrandVoice upsert service: GET/PUT /api/companies/:companySlug/brands/:brandSlug/voice — 1:1 relation with brand, upsert semantics
- MultiCompanyModule aggregates all three modules, registered in AppModule — all endpoints active
- Idempotent seed script creates Verde Kitchen (food), Nexus AI (tech), Aura Fashion (fashion/2 brands) with brand voices and mock social accounts

## Task Commits

Each task was committed atomically:

1. **Task 1: Company CRUD module** — `ea5459d6` (feat)
2. **Task 2: Brand/BrandVoice CRUD, MultiCompanyModule, seed** — `55d900dc` (feat)

## Files Created/Modified

- `extensions/multi-company/src/company/company.service.ts` — Company CRUD: findAll, findBySlug, findById, create, update, delete
- `extensions/multi-company/src/company/company.controller.ts` — REST: GET/POST/PUT/DELETE /api/companies
- `extensions/multi-company/src/company/company.module.ts` — NestJS module wiring
- `extensions/multi-company/src/company/dto/create-company.dto.ts` — CreateCompanyDto with validation
- `extensions/multi-company/src/company/dto/update-company.dto.ts` — UpdateCompanyDto (all optional)
- `extensions/multi-company/src/brand/brand.service.ts` — Brand CRUD scoped by companyId parameter
- `extensions/multi-company/src/brand/brand.controller.ts` — REST: GET/POST/PUT/DELETE /api/companies/:companySlug/brands
- `extensions/multi-company/src/brand/brand.module.ts` — NestJS module wiring
- `extensions/multi-company/src/brand/dto/create-brand.dto.ts` — CreateBrandDto
- `extensions/multi-company/src/brand/dto/update-brand.dto.ts` — UpdateBrandDto
- `extensions/multi-company/src/brand-voice/brand-voice.service.ts` — BrandVoice upsert
- `extensions/multi-company/src/brand-voice/brand-voice.controller.ts` — REST: GET/PUT /voice
- `extensions/multi-company/src/brand-voice/brand-voice.module.ts` — NestJS module wiring
- `extensions/multi-company/src/brand-voice/dto/upsert-brand-voice.dto.ts` — UpsertBrandVoiceDto
- `extensions/multi-company/src/multi-company.module.ts` — Aggregates all three modules
- `extensions/multi-company/src/index.ts` — Barrel export (modules, services, DTOs)
- `extensions/seed/seed.ts` — Idempotent seed for 3 companies with brands/voices/accounts
- `apps/backend/src/app.module.ts` — MultiCompanyModule import added
- `DIVERGENCE.md` — Plan 03 app.module.ts entry added

## Decisions Made

- BrandService uses explicit `companyId` parameter, not CLS. This keeps services testable without mocking the CLS/middleware stack. Isolation contract is explicit in the function signature.
- Controllers resolve slugs to entities and pass IDs to services. Services work with IDs only, which keeps services simpler and avoids slug resolution duplication.
- `(prisma as any).company` cast used throughout because `prisma generate` hasn't been run against the new schema (requires live DB). This is a known temporary state; once Docker is up and `prisma generate` runs, casts can be removed.
- Seed uses upsert with precise unique constraints to be fully idempotent: running twice produces no duplicates.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript compiles without errors. Docker not running (known from Plan 02) means seed and integration tests require `pnpm run dev:docker` first.

## User Setup Required

None beyond what Plan 02 requires:
```bash
pnpm run dev:docker       # Start PostgreSQL
pnpm run prisma:migrate   # Apply company_hierarchy migration
pnpm run prisma:generate  # Regenerate Prisma client types
pnpm run prisma:seed      # Seed Verde Kitchen, Nexus AI, Aura Fashion
```

## Next Phase Readiness

- All Company/Brand/BrandVoice CRUD services are ready for Plan 04 integration tests
- BrandService.findAllByCompany(companyId) is the key method for isolation tests — data must not leak across companies
- Seed script ready for manual verification once Docker is running

## Self-Check: PASSED

- FOUND: extensions/multi-company/src/company/company.service.ts
- FOUND: extensions/multi-company/src/brand/brand.service.ts
- FOUND: extensions/multi-company/src/brand-voice/brand-voice.service.ts
- FOUND: extensions/multi-company/src/multi-company.module.ts
- FOUND: extensions/seed/seed.ts
- FOUND: commit ea5459d6 (feat(01-03): build Company CRUD module)
- FOUND: commit 55d900dc (feat(01-03): build Brand/BrandVoice CRUD)

---
*Phase: 01-fork-and-foundation*
*Completed: 2026-03-10*
