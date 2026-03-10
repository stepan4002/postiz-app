---
phase: 01-fork-and-foundation
plan: 01
subsystem: infra
tags: [postiz, docker, pnpm, monorepo, postgres, redis, minio, typescript, nx, git]

# Dependency graph
requires: []
provides:
  - Postiz v2.20.1 fork with upstream remote and upstream tracking branch
  - Docker Compose dev environment with PostgreSQL 17, Redis 7.2, MinIO
  - Extension zone: three pnpm workspace packages under extensions/
  - DIVERGENCE.md tracking all upstream file modifications
  - Path aliases for @social/* packages in tsconfig.base.json
affects: [02-multi-company-data-model, 03-company-crud, 04-media-library, all-phases]

# Tech tracking
tech-stack:
  added:
    - PostgreSQL 17-alpine (Docker dev service)
    - Redis 7.2-alpine (Docker dev service)
    - MinIO latest (Docker dev service, S3-compatible local storage)
    - nestjs-cls 4.x (dependency declared in @social/company-context)
  patterns:
    - Extension zone pattern: all custom code in extensions/ separate from upstream apps/ and libraries/
    - DIVERGENCE.md log for every upstream file modification
    - Upstream git tracking branch pinned to v2.20.1 tag
    - Docker Compose with health checks and restart: unless-stopped (not Temporal heavyweight stack)

key-files:
  created:
    - docker/docker-compose.dev.yaml
    - docker/.env.dev.example
    - extensions/multi-company/package.json
    - extensions/multi-company/src/index.ts
    - extensions/multi-company/tsconfig.json
    - extensions/company-context/package.json
    - extensions/company-context/src/index.ts
    - extensions/company-context/tsconfig.json
    - extensions/seed/package.json
    - extensions/seed/tsconfig.json
    - DIVERGENCE.md
  modified:
    - pnpm-workspace.yaml (added extensions/** glob)
    - tsconfig.base.json (added @social/* path aliases)
    - .env.example (added S3/MinIO vars)
    - package.json (added dev:docker, dev:docker:down, prisma:migrate, prisma:generate, prisma:seed scripts)

key-decisions:
  - "Merged Postiz v2.20.1 into existing repo using --allow-unrelated-histories rather than clone-and-replace to preserve planning files"
  - "Upstream branch pinned to v2.20.1 tag for future diff comparison against upstream changes"
  - "Custom Docker Compose in docker/ subdirectory to keep separate from upstream docker-compose.dev.yaml at root"
  - "Lightweight dev stack excludes Temporal (saves ~4GB RAM); Temporal added in Phase 6 when orchestrator is needed"
  - "Extension packages are placeholders (empty barrel exports) to be filled in Plan 02"
  - "MinIO added to Docker Compose now (Phase 1) to avoid rework in Phase 4 media pipeline"

patterns-established:
  - "Extension zone: all new code in extensions/, never in apps/ or libraries/"
  - "DIVERGENCE.md log: every upstream file modification documented with phase, date, change, reason, upstream risk, watch-for"
  - "Path aliases: @social/* packages accessed via tsconfig paths, not relative imports"
  - "Docker services: always include health checks and restart: unless-stopped"

requirements-completed: [R1.1, R1.2, R1.3, R1.4, R1.5]

# Metrics
duration: 25min
completed: 2026-03-10
---

# Phase 1 Plan 01: Fork & Foundation Summary

**Postiz v2.20.1 forked with upstream tracking, Docker dev stack with PostgreSQL/Redis/MinIO, and extension zone scaffolded as three pnpm workspace packages**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-10T14:00:00Z
- **Completed:** 2026-03-10T14:25:00Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Postiz v2.20.1 merged into project repo; upstream remote + upstream branch configured for future sync and diff comparison
- Lightweight Docker Compose dev stack created with PostgreSQL 17, Redis 7.2, MinIO — all with health checks and restart policies; no Temporal overhead
- Extension zone established: three pnpm workspace packages (@social/multi-company, @social/company-context, @social/seed) recognized by pnpm and ready for implementation
- DIVERGENCE.md created documenting all four upstream file modifications with structured metadata

## Task Commits

Each task was committed atomically:

1. **Task 1: Fork Postiz and create Docker dev environment** - `b6e6c45b` (feat)
2. **Task 2: Scaffold extension architecture and DIVERGENCE.md** - `af29fa7a` (feat)

**Plan metadata commit:** (docs: to follow)

## Files Created/Modified

- `docker/docker-compose.dev.yaml` - Custom lightweight dev stack: PostgreSQL 17, Redis 7.2, MinIO with health checks
- `docker/.env.dev.example` - All Docker service credentials documented (POSTGRES_*, MINIO_*, DATABASE_URL, S3_*)
- `.env.example` - Extended with S3/MinIO vars for Phase 4 storage readiness
- `package.json` - Added dev:docker, dev:docker:down, prisma:migrate, prisma:generate, prisma:seed scripts
- `extensions/multi-company/package.json` - @social/multi-company package (NestJS multi-company module placeholder)
- `extensions/multi-company/src/index.ts` - Empty barrel export placeholder
- `extensions/multi-company/tsconfig.json` - Extends tsconfig.base.json
- `extensions/company-context/package.json` - @social/company-context package (Prisma $extends + CLS placeholder)
- `extensions/company-context/src/index.ts` - Empty barrel export placeholder
- `extensions/company-context/tsconfig.json` - Extends tsconfig.base.json
- `extensions/seed/package.json` - @social/seed package for database seed scripts
- `extensions/seed/tsconfig.json` - Extends tsconfig.base.json with commonjs module
- `pnpm-workspace.yaml` - Added `extensions/**` glob to workspace packages list
- `tsconfig.base.json` - Added @social/multi-company and @social/company-context path aliases
- `DIVERGENCE.md` - Upstream modification log with 4 entries (pnpm-workspace.yaml, tsconfig.base.json, .env.example, package.json)

## Decisions Made

- Used `--allow-unrelated-histories` merge to bring Postiz v2.20.1 into the existing planning repo — preserves planning commit history alongside Postiz code history
- Upstream branch is pinned to the v2.20.1 tag directly (not to upstream/main) — enables `git diff upstream HEAD -- <file>` to check divergence at any time
- Custom Docker Compose goes in `docker/` subdirectory to distinguish from Postiz's own `docker-compose.dev.yaml` at root and to keep the divergence minimal
- Temporal omitted from dev compose — saves ~4GB RAM; the Postiz backend can start without Temporal (orchestrator service not needed until Phase 6)
- MinIO included in Phase 1 dev compose despite not being needed until Phase 4 — avoids rework and gives developers local S3 from day one

## Deviations from Plan

None - plan executed exactly as written. One note: `npx nx reset` returned "not an NX workspace" because NX CLI isn't installed globally — pnpm workspace registration was verified directly via `pnpm ls -r --depth=0` which confirmed all three @social/* packages are recognized.

## Issues Encountered

- NX is not installed globally (not in PATH); `npx nx reset` failed with "not a workspace" message. This is not a functional issue — pnpm workspace package registration works independently of NX CLI. Extension packages were verified registered via `pnpm ls -r --depth=0`. NX project-level configs (project.json, jest.config.ts per extension) will be added in Plan 02 when NX integration is needed for test running.

## User Setup Required

None - no external service configuration required for this plan.

## Next Phase Readiness

- Fork base is in place — Plan 02 can proceed to extend the Prisma schema with Company/Brand/BrandVoice/SocialAccount models
- Docker dev environment is ready to start with `pnpm run dev:docker`
- Extension packages are scaffolded and discoverable — Plan 02 implementations go into extensions/multi-company/src/ and extensions/company-context/src/
- DIVERGENCE.md is the living log for all upstream file modifications going forward

---
*Phase: 01-fork-and-foundation*
*Completed: 2026-03-10*
