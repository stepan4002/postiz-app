---
phase: 02-credential-management-oauth
plan: 04
subsystem: auth
tags: [nestjs, react, swr, tailwind, token-health, prisma, api-endpoint]

# Dependency graph
requires:
  - phase: 02-credential-management-oauth
    plan: 01
    provides: TokenEncryptionService, Prisma Integration model with lastRefreshedAt/consecutiveFailures/tokenEncrypted fields
  - phase: 02-credential-management-oauth
    plan: 02
    provides: TokenHealthService with getTokenHealth() returning 4-state health enum

provides:
  - "GET /api/credentials/health endpoint via TokenHealthController (NestJS)"
  - "useTokenHealth SWR hook for fetching integration health data from frontend"
  - "TokenHealthBanner React component: amber/red banner when tokens unhealthy"
  - "TokenHealthList React component: full table of connected accounts with health indicators"

affects:
  - 02-03 (CredentialManagementModule in Plan 03 registers TokenHealthController)
  - Phase 7 (Analytics dashboard may surface token health inline)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TokenHealthState frontend type defined locally — backend @social/credential-management not imported in frontend (NestJS deps would break)"
    - "SWR hook pattern: single named export function returning useSWR with useFetch load callback"
    - "CSS variable Tailwind classes for consistent theme (newTableBorder, newTableText, newBgColorInner, etc.)"
    - "Health dot pattern: green-500/amber-500/red-500 for healthy/warning/critical state indicators"

key-files:
  created:
    - extensions/credential-management/src/health/token.health.controller.ts
    - apps/frontend/src/components/credential-health/useTokenHealth.ts
    - apps/frontend/src/components/credential-health/TokenHealthBanner.tsx
    - apps/frontend/src/components/credential-health/TokenHealthList.tsx
  modified: []

key-decisions:
  - "Frontend defines TokenHealthState locally — avoids importing NestJS package (@social/credential-management has @nestjs/common dependency that would break frontend bundler)"
  - "x-company-slug header filtering via direct Prisma lookup — middleware sets CLS context but controller reads header directly for the bootstrap company query, consistent with existing CompanyContextMiddleware pattern"
  - "SocialAccount joined by integrationId FK — more reliable than matching by platform string since integrationId is the direct foreign key set after OAuth flow completes"
  - "Pre-existing TSC errors (oauth.brand.controller.ts tokenEncrypted property, empty.provider.ts any[] type) are out-of-scope pre-existing issues from other Plan 03 files, confirmed by stash verification"

patterns-established:
  - "Health dot pattern: inline-block rounded-full w-3 h-3 with bg-green-500/amber-500/red-500 for health state visual encoding"
  - "Banner severity escalation: warning severity for 'warning' health, critical severity if any 'expired' or 'refresh_needed'"
  - "Frontend type mirroring: define equivalent TypeScript types locally when importing from NestJS packages would introduce incompatible deps"

requirements-completed: [R3.4, R3.5]

# Metrics
duration: 15min
completed: 2026-03-10
---

# Phase 2 Plan 04: Token Health API and Frontend Components Summary

**TokenHealthController (GET /api/credentials/health with brand context via SocialAccount join), useTokenHealth SWR hook, TokenHealthBanner (amber/red alert banner), and TokenHealthList (color-coded integration inventory table)**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-10T16:24:00Z
- **Completed:** 2026-03-10T16:39:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Implemented `TokenHealthController` with `GET /api/credentials/health` that queries all non-deleted integrations, joins SocialAccount by `integrationId` FK to get brand context (brandId, brandName), calls `TokenHealthService.getTokenHealth()` per integration, and computes `daysUntilExpiry` via dayjs; optional `x-company-slug` header filters results by company's organizations
- Implemented `useTokenHealth()` SWR hook following project pattern (single named export, useFetch callback, separate function per CLAUDE.md rules)
- Implemented `TokenHealthBanner` that shows amber (warning) or red (critical: expired/refresh_needed) banner with count and link to Settings when unhealthy tokens exist; renders null when healthy or loading
- Implemented `TokenHealthList` with sortable table rows showing health dot (green/amber/red), provider name, account name, brand, health label, failure count, last-refreshed relative time, and expiry date; includes empty state and loading skeleton

## Task Commits

Each task was committed atomically:

1. **Task 1: Token health API endpoint controller** - `a7396d5d` (feat)
2. **Task 2: Frontend token health hook and components** - `77b746d0` (feat)

## Files Created/Modified

- `extensions/credential-management/src/health/token.health.controller.ts` - TokenHealthController: GET /api/credentials/health with brand context, company filtering, and TokenHealthService integration
- `apps/frontend/src/components/credential-health/useTokenHealth.ts` - useTokenHealth() SWR hook using useFetch; defines TokenHealthState/TokenHealthItem/TokenHealthResponse interfaces locally
- `apps/frontend/src/components/credential-health/TokenHealthBanner.tsx` - Dashboard banner with amber/red severity based on worst health state across unhealthy integrations
- `apps/frontend/src/components/credential-health/TokenHealthList.tsx` - Full integration inventory table with health dots, refresh times, expiry info, and empty/loading states

## Decisions Made

- **Frontend type isolation**: `TokenHealthState` and related response interfaces defined locally in `useTokenHealth.ts` — importing from `@social/credential-management` would pull in NestJS dependencies (`@nestjs/common`, `reflect-metadata`) incompatible with Vite/React frontend bundling
- **SocialAccount join strategy**: Joined by `integrationId` FK (set after OAuth flow) rather than `platform` string match — FK is unambiguous; platform match could return wrong brand if same platform is used across multiple brands
- **Company filtering**: Direct Prisma bootstrap query for company lookup (same pattern as `CompanyContextMiddleware`) — reads `x-company-slug` header directly rather than relying on CLS, making the filter explicit and testable
- **No module modification**: `credential-management.module.ts` not touched — Plan 03 already registers `TokenHealthController` in the module, preventing write conflicts between parallel plans

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Pre-existing TypeScript errors in `extensions/credential-management/src/oauth/oauth.brand.controller.ts` (missing `tokenEncrypted` type) and `libraries/nestjs-libraries/src/emails/empty.provider.ts` (implicit any[]) were present before Plan 04 and confirmed out-of-scope. The new `token.health.controller.ts` file has zero TypeScript errors.
- Frontend `tsconfig.base.json` has no path alias for `@social/credential-management` — resolved by defining `TokenHealthState` locally in the hook (correct approach; avoids NestJS dependency in frontend).

## User Setup Required

None - no new environment variables or external services required. The endpoint uses existing PrismaService and TokenHealthService injected via NestJS DI (handled by Plan 03's module).

## Next Phase Readiness

- `TokenHealthController` is ready to register — Plan 03's `credential-management.module.ts` adds it to the controllers array
- `TokenHealthBanner` can be placed in the main dashboard layout component (e.g., `apps/frontend/src/components/layout/`) — import and add above page content
- `TokenHealthList` can be placed in a settings page or dedicated health dashboard page — self-contained, no props required
- Both components are SWR-cached and revalidate on focus by default

---
*Phase: 02-credential-management-oauth*
*Completed: 2026-03-10*
