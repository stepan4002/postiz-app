# DIVERGENCE.md — Upstream Modification Log

This file tracks every modification made to upstream Postiz files.
All custom code lives in `extensions/` — upstream files are modified only when absolutely necessary.

**Format:**
- **Phase:** Which project phase introduced the change
- **Date:** When the change was made
- **Change:** What was modified and how
- **Reason:** Why the upstream file had to be touched
- **Upstream risk:** Risk level if upstream changes the same area
- **Watch for:** What to check when merging upstream updates

---

## pnpm-workspace.yaml

- **Phase:** 1
- **Date:** 2026-03-10
- **Change:** Added `extensions/**` to the `packages` array alongside `apps/*` and `libraries/*`
- **Reason:** pnpm workspaces require all package roots to be listed; adding `extensions/` as the custom code directory requires this one-line addition
- **Upstream risk:** LOW — upstream rarely modifies pnpm-workspace.yaml; adding back our line after merge is trivial
- **Watch for:** Upstream adding new package directories that might conflict with glob ordering

---

## tsconfig.base.json

- **Phase:** 1
- **Date:** 2026-03-10
- **Change:** Added `@social/multi-company` and `@social/company-context` path aliases to `compilerOptions.paths`
- **Reason:** TypeScript path aliases enable `import { ... } from '@social/multi-company'` across the monorepo without fragile relative paths
- **Upstream risk:** LOW — upstream adds new `@gitroom/*` path entries; simply re-add `@social/*` entries after merge
- **Watch for:** Upstream restructuring the `paths` object or changing `baseUrl`

---

## .env.example

- **Phase:** 1
- **Date:** 2026-03-10
- **Change:** Added S3/MinIO environment variables (`S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`) and updated `STORAGE_PROVIDER` comment
- **Reason:** MinIO is not included in upstream Postiz by default; Phase 4 media pipeline requires S3-compatible storage; documenting env vars here ensures developers know what to set
- **Upstream risk:** LOW — upstream may add new env vars but not the same S3 variable names
- **Watch for:** Upstream adding official S3/MinIO support (PR #1125) which may use different variable names

---

## package.json

- **Phase:** 1
- **Date:** 2026-03-10
- **Change:** Modified `dev:docker` script path to `docker/docker-compose.dev.yaml`; added `dev:docker:down`, `prisma:migrate`, `prisma:generate`, `prisma:seed` convenience scripts
- **Reason:** Custom Docker Compose lives in `docker/` subdirectory (not root); additional prisma migrate commands needed for proper migration history; seed script references extension zone
- **Upstream risk:** MEDIUM — upstream regularly modifies package.json scripts; re-apply our script additions after merge
- **Watch for:** Upstream changing existing `dev:docker` script, adding conflicting script names, or changing prisma version used in scripts

---

## apps/backend/src/app.module.ts

- **Phase:** 1 (Plan 02)
- **Date:** 2026-03-10
- **Change:** Added `import { CompanyContextModule } from '@social/company-context'` and added `CompanyContextModule` to the `@Module` imports array before `ApiModule`
- **Reason:** CompanyContextModule must be registered in AppModule to activate the ClsModule global context and the CompanyContextMiddleware that auto-scopes Prisma queries by company
- **Upstream risk:** MEDIUM — upstream regularly adds imports to AppModule; re-add our CompanyContextModule import and ensure it stays before ApiModule after merge
- **Watch for:** Upstream adding conflicting CLS or middleware registrations; upstream reordering imports that might break global ClsModule initialization

---

## libraries/nestjs-libraries/src/database/prisma/schema.prisma

- **Phase:** 1 (Plan 02)
- **Date:** 2026-03-10
- **Change:** Added Company, Brand, BrandVoice, SocialAccount models in a clearly marked block above the Organization model; added nullable `companyId` FK field + index to the Organization model; created initial migration `20260310000000_company_hierarchy`
- **Reason:** Multi-company hierarchy required for data isolation — Company and Brand hierarchy are the foundation of all subsequent features; companyId on Organization links existing Postiz workspaces to the new company layer
- **Upstream risk:** MEDIUM — upstream may add new models or modify existing ones; our models are in a self-contained named block; Organization field addition is the only inline change and is at the bottom of the field list to minimize merge conflicts
- **Watch for:** Upstream adding any field named `companyId` to Organization; upstream adding models with names that conflict with Company/Brand/BrandVoice/SocialAccount; upstream schema format changes

---

## apps/backend/src/app.module.ts (Plan 03 addition)

- **Phase:** 1 (Plan 03)
- **Date:** 2026-03-10
- **Change:** Added `import { MultiCompanyModule } from '@social/multi-company'` and added `MultiCompanyModule` to the `@Module` imports array after `CompanyContextModule`
- **Reason:** MultiCompanyModule registers the Company/Brand/BrandVoice REST endpoints; must be in AppModule to be active
- **Upstream risk:** MEDIUM — upstream regularly adds imports to AppModule; re-add our MultiCompanyModule import after merge
- **Watch for:** Upstream adding route prefixes or global route guards that might conflict with /api/companies routes

---
