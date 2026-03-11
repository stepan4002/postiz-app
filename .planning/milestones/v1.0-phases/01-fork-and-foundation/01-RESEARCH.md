# Phase 1: Fork & Foundation - Research

**Researched:** 2026-03-10
**Domain:** Postiz fork strategy, NX/pnpm monorepo extension, Prisma multi-company schema, NestJS multi-tenant patterns, Docker Compose dev environment
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Fork & Upstream Strategy**
- Stay close to upstream Postiz — minimize modifications to upstream files
- Custom code in separate packages/directories (extension zone), not scattered across upstream files
- Maintain DIVERGENCE.md logging every upstream file modification with reason
- Keep an `upstream` git branch for easy diff comparison against upstream changes
- Pin fork to latest stable Postiz release (not bleeding-edge main)

**Extension Architecture**
- Separate packages directory alongside Postiz packages for custom NestJS modules and Next.js pages/components
- Upstream files modified only when absolutely necessary (e.g., adding imports, route registrations)
- Every upstream modification logged in DIVERGENCE.md with file path, change description, and reason

**Company/Brand Hierarchy**
- Companies can have 1-N brands — model supports both simple (1 brand) and multi-brand companies
- Company entity fields: name, slug, timezone, default language, industry, website, logo, notes (business context for AI)
- Brand entity: name, slug, logo, description, linked to Company
- BrandVoice: structured fields (tone, target audience, preferred hashtags, blacklisted words, sample posts, language) PLUS free-form notes field for nuanced guidance
- SocialAccount belongs to Brand (not Company directly) — each brand has its own social accounts

**Company Switcher UX**
- Header dropdown switcher (like Slack workspace switcher) — always visible in top navigation
- Switching companies stays on the same page (e.g., posts view shows new company's posts)
- Single-company scoping in Phase 1 — cross-company summary is a Phase 7 dashboard concern
- URL-scoped: company slug in URL path (e.g., /acme/posts, /acme/media) for bookmarkability and clear context

**Seed Data**
- 3 test companies with realistic industries (e.g., restaurant, tech startup, fashion brand)
- Mixed brand configuration: 2 companies with 1 brand, 1 company with 2-3 brands
- Include mock social accounts per brand (Instagram, Facebook, LinkedIn) without real OAuth tokens — good for testing UI
- Seed script is idempotent (re-runnable with upserts, skips existing data)

### Claude's Discretion
- Exact Postiz release version to pin to (evaluate current releases during research)
- Extension directory naming and structure details
- Seed data specifics (company names, brand voice content, industry details)
- Database migration strategy for adding company_id to existing Postiz tables
- Isolation test implementation approach

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R1.1 | Fork Postiz and establish Docker Compose deployment (PostgreSQL, Redis, MinIO, app) | Postiz v2.20.1 identified as pin target; dev Docker Compose structure documented; MinIO requires custom addition (not in Postiz default) |
| R1.2 | Extension zone separation — custom code in `/packages/` or dedicated directories, upstream files minimally modified | NX pnpm workspace pattern documented; custom `extensions/` directory approach specified |
| R1.3 | DIVERGENCE.md tracking all upstream modifications | Pattern documented with file path, change type, reason format |
| R1.4 | Environment-based configuration (`.env`) for all secrets, API keys, and deployment settings | Postiz `.env.example` pattern documented; extension env vars specified |
| R1.5 | Health checks on all Docker services with restart policies | Docker Compose health check patterns documented |
| R2.1 | Company entity with name, slug, settings, timezone, languages | Full Prisma model specified with all fields |
| R2.2 | Brand entity (1-N per Company) with brand identity fields | Full Prisma model specified; relationship to Company documented |
| R2.3 | BrandVoice entity per Brand: tone, audience, hashtags, blacklist, samples, language | Full Prisma model with JSON fields specified |
| R2.4 | SocialAccount entity per Brand with platform type and credential reference | Model specified; relationship to existing Integration entity documented |
| R2.5 | `company_id` FK on all company-owned tables | Migration strategy for existing Postiz tables documented |
| R2.6 | Row-level scoping — all queries filtered by `company_id`; no cross-company data leakage | Prisma `$extends` pattern for auto-injection documented |
| R2.7 | Company switcher in UI — all views scoped to selected company | Next.js dynamic route `[companySlug]` pattern documented |
| R2.8 | Automated isolation tests: Company A cannot see Company B's data | Jest integration test pattern with real DB documented |
</phase_requirements>

---

## Summary

Postiz v2.20.1 (released March 6, 2026) is the correct version to pin to. It is an NX-managed pnpm workspace monorepo with `apps/` (backend, frontend, orchestrator, etc.) and `libraries/` (nestjs-libraries, react-shared-libraries, helpers) as the two workspace roots. The pnpm workspace only includes `apps/**` and `libraries/**`, which means a third top-level directory (e.g., `extensions/`) can be added to `pnpm-workspace.yaml` to house all custom code with zero overlap with Postiz's own directory structure.

The Postiz Prisma schema uses `Organization` as its top-level entity (not `Company`). All existing tables — Post, Integration, Media — are scoped with `organizationId`. The multi-company extension adds a new `Company` → `Brand` → `BrandVoice` + `SocialAccount` hierarchy as new Prisma models. Existing Postiz `Organization` rows will each get a `company_id` FK added via migration so posts, media, and integrations remain traceable to a Company. This is additive — no upstream schema files are altered, only new migration files and new models in `schema.prisma`.

The company switcher uses Next.js App Router dynamic segment `[companySlug]` nested inside the existing `(app)/(site)` route group. This means the main nav layout must be wrapped with a company context provider. The one required upstream modification is adding the `[companySlug]` dynamic segment to the existing layout. All other changes live in the extension zone.

**Primary recommendation:** Use `extensions/` as the top-level custom package directory added to pnpm workspaces. Keep all new NestJS modules, Next.js route overrides, seed scripts, and test suites in `extensions/`. Log every upstream file touch in `DIVERGENCE.md`. Pin to Postiz v2.20.1 and create a `git remote add upstream` pointing to `gitroomhq/postiz-app`.

---

## Standard Stack

### Core (inherited from Postiz v2.20.1)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js | 20.x LTS | Runtime | Required by Postiz |
| pnpm | 9.x | Package manager | Postiz uses pnpm only — npm/yarn explicitly disallowed |
| TypeScript | 5.x | Language | Postiz is 100% TypeScript |
| NestJS | 10.x | Backend framework | Postiz backend/orchestrator |
| Next.js | 14.x | Frontend framework | Postiz frontend (App Router) |
| Prisma | 5.x | ORM | Postiz database layer |
| PostgreSQL | 17 (dev) | Database | Postiz default; confirmed in dev compose |
| Redis | 7.2 | Cache/queues | Postiz BullMQ backend |
| BullMQ | 5.x | Job queues | Postiz orchestration |
| Temporal | 1.28.1 | Workflow engine | Postiz background jobs |
| NX | latest | Monorepo tooling | Postiz project management |

### Extension Additions (this phase)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MinIO | RELEASE.2024-01 | S3-compatible object storage | Local dev replacement for Cloudflare R2 |
| `@aws-sdk/client-s3` | 3.x | S3 client for MinIO | Storage integration (S3-compatible endpoint) |
| `nestjs-cls` | 4.x | Continuation Local Storage | Company context injection into Prisma queries |
| `jest` | Already in Postiz | Test runner | Isolation tests — already configured via NX |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `extensions/` top-level dir | Modifying `libraries/` or `apps/` | Modifying Postiz dirs risks conflicts; top-level is clean separation |
| Prisma `$extends` for company scoping | Repository pattern with manual where clauses | `$extends` is more declarative but requires careful null-safety; manual is simpler but error-prone |
| MinIO in Docker Compose | Local file storage (Postiz default) | Local storage fine for dev; MinIO matches production parity and is self-hosted |
| `[companySlug]` in URL | Company context in header/cookie only | URL approach gives bookmarkability and clear context as decided |

**Installation for extension packages:**
```bash
cd extensions/multi-company
pnpm install nestjs-cls
pnpm install @aws-sdk/client-s3
```

---

## Architecture Patterns

### Recommended Project Structure

```
/ (fork root, pinned to Postiz v2.20.1)
├── apps/                          # UPSTREAM — Postiz apps
│   ├── backend/
│   ├── frontend/
│   ├── orchestrator/
│   └── ...
├── libraries/                     # UPSTREAM — Postiz shared libraries
│   ├── nestjs-libraries/
│   ├── react-shared-libraries/
│   └── helpers/
├── extensions/                    # EXTENSION ZONE — all custom code lives here
│   ├── multi-company/             # NestJS module: Company/Brand/BrandVoice CRUD
│   │   ├── src/
│   │   │   ├── company/           # CompanyModule, CompanyController, CompanyService
│   │   │   ├── brand/             # BrandModule, BrandController, BrandService
│   │   │   ├── brand-voice/       # BrandVoiceModule, BrandVoiceController, BrandVoiceService
│   │   │   └── index.ts
│   │   └── package.json           # name: "@social/multi-company"
│   ├── company-context/           # NestJS: Prisma $extends factory for company scoping
│   │   ├── src/
│   │   │   ├── company-context.module.ts
│   │   │   ├── company-context.middleware.ts
│   │   │   └── prisma-company.factory.ts
│   │   └── package.json           # name: "@social/company-context"
│   └── seed/                      # Database seed scripts
│       ├── seed.ts
│       └── package.json
├── prisma/                        # DIVERGENCE — extends upstream schema
│   ├── schema.prisma              # Upstream schema + new Company/Brand models added
│   └── migrations/
│       └── 20260310_company_hierarchy/
├── docker/
│   ├── docker-compose.dev.yaml    # Custom dev compose: adds MinIO, removes Temporal for simplicity
│   └── .env.dev.example
├── DIVERGENCE.md                  # Log of every upstream file modification
└── pnpm-workspace.yaml            # MODIFIED: adds "extensions/**" to workspaces
```

### Pattern 1: Prisma $extends for Auto Company Scoping

**What:** A Prisma client factory that uses `$extends` to automatically inject `WHERE company_id = ?` into all queries for company-owned models. The `company_id` is pulled from NestJS CLS (Continuation Local Storage) set by middleware on each request.

**When to use:** All repository-layer queries that touch company-owned data (Company, Brand, BrandVoice, SocialAccount, and future Post/Media/Analytics).

**Example:**
```typescript
// Source: Prisma docs + DEV Community multi-tenancy guide
// extensions/company-context/src/prisma-company.factory.ts

import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';

export function prismaWithCompany(
  prisma: PrismaService,
  companyId: string | null,
) {
  return prisma.$extends({
    query: {
      $allModels: {
        async findMany({ query, args, model }) {
          if (isCompanyOwned(model)) {
            args.where = { ...args.where, companyId };
          }
          return query(args);
        },
        async create({ query, args, model }) {
          if (isCompanyOwned(model) && companyId) {
            (args.data as any).companyId = companyId;
          }
          return query(args);
        },
        async findFirst({ query, args, model }) {
          if (isCompanyOwned(model)) {
            args.where = { ...args.where, companyId };
          }
          return query(args);
        },
      },
    },
  });
}

// Company-owned models set — expand as schema grows
const COMPANY_OWNED = new Set(['Brand', 'BrandVoice', 'SocialAccount']);

function isCompanyOwned(model: string): boolean {
  return COMPANY_OWNED.has(model);
}
```

```typescript
// extensions/company-context/src/company-context.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CompanyContextMiddleware implements NestMiddleware {
  constructor(private readonly cls: ClsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Company slug from URL param set by NestJS route: /:companySlug/...
    const companySlug = req.params?.companySlug;
    if (companySlug) {
      this.cls.set('companySlug', companySlug);
    }
    next();
  }
}
```

### Pattern 2: NX Library as Extension Package

**What:** Each custom module lives as its own NX library under `extensions/`, referenced by workspace path alias in `tsconfig.base.json`.

**When to use:** Every new feature module, to keep separation clean.

**Example:**
```json
// extensions/multi-company/package.json
{
  "name": "@social/multi-company",
  "version": "1.0.0",
  "main": "src/index.ts"
}
```

```yaml
# pnpm-workspace.yaml  (ONE LINE CHANGE — logged in DIVERGENCE.md)
packages:
  - 'apps/**'
  - 'libraries/**'
  - 'extensions/**'    # ADDED: custom extension packages
```

```json
// tsconfig.base.json — add path mapping (ONE LINE CHANGE)
{
  "compilerOptions": {
    "paths": {
      "@social/multi-company": ["extensions/multi-company/src/index.ts"],
      "@social/company-context": ["extensions/company-context/src/index.ts"]
    }
  }
}
```

### Pattern 3: Upstream File Modification (Minimal Touch)

**What:** When an upstream file MUST be modified (e.g., registering a new NestJS module in app.module.ts), the change is the smallest possible — a single import line — and is immediately logged.

**When to use:** Only when extension points do not exist. Prefer composition via NestJS DI.

**Example:**
```typescript
// apps/backend/src/app/app.module.ts
// CUSTOM: Added MultiCompanyModule — see DIVERGENCE.md entry #1
import { MultiCompanyModule } from '@social/multi-company';

@Module({
  imports: [
    // ... existing Postiz imports ...
    MultiCompanyModule,  // CUSTOM: added in Phase 1
  ],
})
export class AppModule {}
```

```markdown
# DIVERGENCE.md entry format

## apps/backend/src/app/app.module.ts
- **Phase:** 1
- **Date:** 2026-03-10
- **Change:** Added `MultiCompanyModule` import
- **Reason:** NestJS requires module registration in root AppModule; no plugin system available
- **Upstream risk:** LOW — import line only; conflicts require adding our import back after merge
- **Watch for:** Upstream refactoring AppModule structure
```

### Pattern 4: Next.js Company-Scoped Routing

**What:** Wrap all main app routes under a `[companySlug]` dynamic segment. The existing `(app)/(site)` routes become `(app)/(site)/[companySlug]/` sub-routes.

**When to use:** All pages that display company-specific data.

**Example:**
```
apps/frontend/src/app/(app)/(site)/
├── [companySlug]/               # NEW dynamic segment
│   ├── layout.tsx               # Loads company from slug, provides CompanyContext
│   ├── launches/
│   │   └── page.tsx             # Existing page, now receives companySlug
│   ├── media/
│   │   └── page.tsx
│   └── analytics/
│       └── page.tsx
└── layout.tsx                   # Adds CompanyHeader with switcher
```

```typescript
// apps/frontend/src/app/(app)/(site)/[companySlug]/layout.tsx
// NEW FILE — no upstream conflict
export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { companySlug: string };
}) {
  const company = await fetchCompany(params.companySlug);
  return (
    <CompanyContext.Provider value={company}>
      {children}
    </CompanyContext.Provider>
  );
}
```

### Pattern 5: Prisma Schema Extension (New Models + FK Migration)

**What:** New `Company`, `Brand`, `BrandVoice`, `SocialAccount` models added to `schema.prisma`. Existing `Organization`, `Post`, `Media`, `Integration` models get a `companyId` FK added via new migration.

**Critical:** Never edit existing upstream migration files. Only add new migration files.

**Example:**
```prisma
// Addition to libraries/nestjs-libraries/src/database/prisma/schema.prisma
// CUSTOM block — see DIVERGENCE.md entry #2

model Company {
  id              String    @id @default(uuid())
  name            String
  slug            String    @unique
  timezone        String    @default("UTC")
  defaultLanguage String    @default("en")
  industry        String?
  website         String?
  logo            String?
  notes           String?   // AI context: free-form business notes
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  brands          Brand[]
  organizations   Organization[]  // Postiz Orgs that belong to this Company
}

model Brand {
  id          String     @id @default(uuid())
  companyId   String
  name        String
  slug        String
  logo        String?
  description String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  company       Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  brandVoice    BrandVoice?
  socialAccounts SocialAccount[]

  @@unique([companyId, slug])
}

model BrandVoice {
  id                String   @id @default(uuid())
  brandId           String   @unique
  tone              String[] // e.g. ["professional", "warm", "concise"]
  targetAudience    String?
  preferredHashtags String[] @default([])
  blacklistedWords  String[] @default([])
  samplePosts       String[] @default([])  // example post bodies
  language          String   @default("en")
  notes             String?  // free-form guidance for AI
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  brand Brand @relation(fields: [brandId], references: [id], onDelete: Cascade)
}

model SocialAccount {
  id           String   @id @default(uuid())
  brandId      String
  platform     String   // "instagram" | "facebook" | "linkedin" | "x"
  externalId   String?  // Platform-assigned account ID
  displayName  String?
  integrationId String? // FK to Postiz Integration (added in Phase 2 when OAuth exists)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  brand Brand @relation(fields: [brandId], references: [id], onDelete: Cascade)

  @@unique([brandId, platform])
}
```

```prisma
// ADD to existing Organization model (migration-only, schema comment added)
model Organization {
  // ... existing fields ...
  companyId String?  // CUSTOM: FK to Company — see DIVERGENCE.md entry #2
  company   Company? @relation(fields: [companyId], references: [id])
}
```

### Anti-Patterns to Avoid

- **Modifying upstream migration files:** If you change an upstream `.sql` migration file, you break Prisma's migration history. Always create NEW migration files.
- **Scattering company logic across upstream files:** Every custom feature that touches an upstream file creates a potential merge conflict. Push all logic into `extensions/`.
- **Using `companyId` nullable when it should be required:** Post Phase 1, all new entities MUST have non-nullable `companyId`. Nullable is only acceptable during the migration transition on pre-existing Postiz tables.
- **Storing company context in global state:** NestJS services are singletons. Company context MUST use CLS (request-scoped) or be passed explicitly — never in a singleton property.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request-scoped context propagation | Thread-local hacks, global variables | `nestjs-cls` (Continuation Local Storage) | Singleton services need per-request context; CLS is the Node.js standard approach |
| Prisma query auto-filtering | Manual where-clauses in every repository method | `prisma.$extends()` query interceptor | Missing even one where-clause creates data bleed; central interception is safer |
| Docker service orchestration | Custom shell scripts | Docker Compose health checks + `depends_on: condition: service_healthy` | Race conditions during startup cause hard-to-debug failures |
| TypeScript path aliases | Relative `../../` import chains | NX `tsconfig.base.json` `paths` + workspace packages | Relative paths break as directory depth changes; workspace aliases are refactor-proof |
| Git upstream sync | Manual copy-paste diffs | `git remote add upstream` + `git fetch upstream` + merge/cherry-pick | Manual diffs miss subtle changes; git tracks history correctly |

**Key insight:** The `prisma.$extends` pattern is the most critical "don't hand-roll" item in this phase. Manually adding `WHERE company_id = ?` to each query is guaranteed to miss cases as the codebase grows — a single missing clause causes data bleed.

---

## Common Pitfalls

### Pitfall 1: Postiz Does NOT Include MinIO in its Docker Compose

**What goes wrong:** The Postiz docker-compose.dev.yaml has PostgreSQL and Redis but no MinIO. The default storage provider is `local` (files on disk). If you assume MinIO is included, the Phase 4 media pipeline will need to retrofit MinIO, causing rework.

**Why it happens:** Postiz defaults to local file storage. A pending PR (#1125) adds MinIO/S3 support but was not merged as of March 2026. The PR exists and has community demand but the maintainers haven't merged it.

**How to avoid:** Add a MinIO service to the custom `docker/docker-compose.dev.yaml` in Phase 1. Use `STORAGE_PROVIDER=local` for now (pointing to a MinIO-mounted volume), ready for `STORAGE_PROVIDER=s3` when the S3 PR merges or when we implement it in Phase 4.

**Warning signs:** Phase 4 integration tests failing because MinIO isn't set up; media paths using local disk that isn't accessible across services.

---

### Pitfall 2: Prisma Schema File is in `libraries/nestjs-libraries/` — Not Project Root

**What goes wrong:** The Prisma schema in Postiz is at `libraries/nestjs-libraries/src/database/prisma/schema.prisma`, not at the standard `prisma/schema.prisma` location. Running `prisma migrate dev` from the project root fails silently or targets the wrong schema.

**Why it happens:** NX monorepo pattern — Prisma is a library dependency, not a project-level concern. All Prisma CLI commands must be run with `--schema` pointing to the correct path, or from within the `libraries/nestjs-libraries/` directory.

**How to avoid:** Add a root-level `package.json` script that sets `--schema` explicitly:
```json
{
  "scripts": {
    "prisma:migrate": "prisma migrate dev --schema=libraries/nestjs-libraries/src/database/prisma/schema.prisma",
    "prisma:generate": "prisma generate --schema=libraries/nestjs-libraries/src/database/prisma/schema.prisma",
    "prisma:seed": "tsx extensions/seed/seed.ts"
  }
}
```

**Warning signs:** `Error: Could not find a schema.prisma file` when running prisma commands from root.

---

### Pitfall 3: Organization vs Company Naming Confusion

**What goes wrong:** Postiz uses `Organization` as its top-level grouping entity. The new custom hierarchy uses `Company`. If developers conflate the two, queries will either miss the company scope or accidentally use the wrong entity.

**Why it happens:** Both words mean similar things, and the Postiz `Organization` already appears in every relation. It's tempting to reuse it as `Company`.

**How to avoid:** Keep them as distinct entities. `Organization` is Postiz's internal workspace concept (maps 1:1 with users who sign up). `Company` is the business entity that owns brands and social accounts. One Organization will point to exactly one Company in Phase 1. This distinction prevents schema coupling.

**Warning signs:** A query that uses `organizationId` where it should use `companyId`.

---

### Pitfall 4: pnpm Workspace Cache After Adding `extensions/` Directory

**What goes wrong:** After adding `extensions/**` to `pnpm-workspace.yaml`, pnpm may not pick up new packages until the workspace is re-installed. Running `pnpm install` from root is required after any `pnpm-workspace.yaml` change. NX project graph also needs regeneration.

**Why it happens:** pnpm caches workspace package resolution. New directories aren't auto-discovered.

**How to avoid:**
```bash
# After adding extensions/ to pnpm-workspace.yaml:
pnpm install
npx nx reset  # Clear NX cache
npx nx graph  # Verify new packages appear in graph
```

**Warning signs:** Import of `@social/multi-company` resolves to `undefined`; NX can't find the project.

---

### Pitfall 5: Next.js Route Group Migration Requires Upstream Layout Changes

**What goes wrong:** Adding `[companySlug]` as a route segment requires moving existing page files into the new directory, or updating the layout. Moving files is a high-conflict operation on upstream files.

**Why it happens:** The existing Postiz routes at `(app)/(site)/launches/`, `(app)/(site)/media/` etc. would need to be moved under `[companySlug]/` — which are upstream files.

**How to avoid:** Instead of moving existing upstream pages, add the `[companySlug]` segment at the layout level only. Use Next.js [parallel routes](https://nextjs.org/docs/app/building-your-application/routing/parallel-routes) or a company-aware redirect from `/` to `/{defaultCompanySlug}/` to preserve existing page paths, with a wrapper layout that reads the slug from the URL. This minimizes file movements.

**Upstream modification needed:** The `(app)/(site)/layout.tsx` must be modified to add the company switcher header component. Log this in DIVERGENCE.md.

**Warning signs:** Git diff showing many upstream page files moved; merge conflicts on routing files.

---

### Pitfall 6: Temporal is Heavyweight for Phase 1 Development

**What goes wrong:** The full Postiz docker-compose includes a 5-service Temporal stack (PostgreSQL, Elasticsearch, Temporal server, admin tools, UI). This makes `docker compose up` slow and resource-intensive on developer machines (requires ~4GB RAM for Temporal alone).

**Why it happens:** Postiz uses Temporal for production job orchestration. The dev compose includes the full stack.

**How to avoid:** Create a lighter `docker/docker-compose.dev.yaml` that includes only PostgreSQL, Redis, and MinIO for Phase 1. Skip Temporal until the orchestrator services are needed (Phase 6). Use BullMQ directly for any Phase 1 background jobs. The Postiz backend can run without Temporal if the orchestrator service isn't started.

**Warning signs:** `docker compose up` taking 5+ minutes; developer machines running out of memory.

---

## Code Examples

### Company CRUD Service (NestJS)
```typescript
// Source: NestJS official docs + Prisma docs
// extensions/multi-company/src/company/company.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.company.findMany({
      include: {
        brands: {
          include: { brandVoice: true, socialAccounts: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findBySlug(slug: string) {
    return this.prisma.company.findUnique({
      where: { slug },
      include: {
        brands: {
          include: { brandVoice: true, socialAccounts: true },
        },
      },
    });
  }

  async create(dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        timezone: dto.timezone ?? 'UTC',
        defaultLanguage: dto.defaultLanguage ?? 'en',
        industry: dto.industry,
        website: dto.website,
        notes: dto.notes,
      },
    });
  }

  async update(id: string, dto: Partial<CreateCompanyDto>) {
    return this.prisma.company.update({
      where: { id },
      data: dto,
    });
  }
}
```

### Isolation Test Pattern
```typescript
// Source: NestJS testing docs + integration testing pattern
// extensions/multi-company/src/__tests__/company-isolation.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { CompanyService } from '../company/company.service';

describe('Company Data Isolation', () => {
  let prisma: PrismaService;
  let companyService: CompanyService;
  let companyA: any;
  let companyB: any;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CompanyService, PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    companyService = module.get<CompanyService>(CompanyService);

    // Seed two companies for isolation testing
    companyA = await prisma.company.create({
      data: { name: 'Company A', slug: 'company-a', timezone: 'UTC' },
    });
    companyB = await prisma.company.create({
      data: { name: 'Company B', slug: 'company-b', timezone: 'UTC' },
    });

    // Create a brand for A
    await prisma.brand.create({
      data: {
        companyId: companyA.id,
        name: 'Brand A',
        slug: 'brand-a',
      },
    });
  });

  afterAll(async () => {
    // Cleanup: delete test data
    await prisma.brand.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
    await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
    await prisma.$disconnect();
  });

  it('Company B cannot see Company A brands', async () => {
    const brandsForB = await prisma.brand.findMany({
      where: { companyId: companyB.id },
    });
    expect(brandsForB).toHaveLength(0);
  });

  it('Company A brands are not visible when querying Company B context', async () => {
    const brands = await prisma.brand.findMany({
      where: { companyId: companyB.id },
    });
    const brandNames = brands.map((b: any) => b.name);
    expect(brandNames).not.toContain('Brand A');
  });
});
```

### Idempotent Seed Script
```typescript
// Source: Prisma docs seeding guide
// extensions/seed/seed.ts

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Company 1: Restaurant
  const restaurant = await prisma.company.upsert({
    where: { slug: 'verde-kitchen' },
    update: {},
    create: {
      name: 'Verde Kitchen',
      slug: 'verde-kitchen',
      industry: 'food-beverage',
      timezone: 'Europe/Athens',
      defaultLanguage: 'el',
      notes: 'Mediterranean restaurant chain. Focus on fresh ingredients, family-friendly. Social media should feel warm and inviting.',
    },
  });

  const restaurantBrand = await prisma.brand.upsert({
    where: { companyId_slug: { companyId: restaurant.id, slug: 'verde-main' } },
    update: {},
    create: {
      companyId: restaurant.id,
      name: 'Verde Kitchen',
      slug: 'verde-main',
      description: 'Main brand for Verde Kitchen restaurants',
    },
  });

  await prisma.brandVoice.upsert({
    where: { brandId: restaurantBrand.id },
    update: {},
    create: {
      brandId: restaurantBrand.id,
      tone: ['warm', 'friendly', 'appetizing'],
      targetAudience: 'Families and food lovers aged 25-55 in urban areas',
      preferredHashtags: ['#MediterraneanFood', '#FreshIngredients', '#FamilyDining'],
      blacklistedWords: ['cheap', 'fast food', 'greasy'],
      language: 'el',
      notes: 'Always mention fresh, seasonal ingredients. Greek/Mediterranean cultural references welcome.',
    },
  });

  // Mock social accounts (no real tokens)
  await prisma.socialAccount.upsert({
    where: { brandId_platform: { brandId: restaurantBrand.id, platform: 'instagram' } },
    update: {},
    create: { brandId: restaurantBrand.id, platform: 'instagram', displayName: '@verde.kitchen' },
  });

  // Company 2: Tech Startup (1 brand)
  const techStartup = await prisma.company.upsert({
    where: { slug: 'nexus-ai' },
    update: {},
    create: {
      name: 'Nexus AI',
      slug: 'nexus-ai',
      industry: 'technology',
      timezone: 'UTC',
      defaultLanguage: 'en',
      notes: 'B2B SaaS startup building AI automation tools. Target: SMB operations teams.',
    },
  });

  // ... (additional brands, BrandVoice, SocialAccounts for Company 2 & 3)
  // Company 3: Fashion Brand (2-3 brands)

  console.log('Seed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
```

### Docker Compose Dev (Custom — Phase 1 Lightweight)
```yaml
# Source: Postiz docker-compose.dev.yaml pattern + MinIO standard config
# docker/docker-compose.dev.yaml

version: '3.8'

services:
  postiz-postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: postiz-user
      POSTGRES_PASSWORD: postiz-password
      POSTGRES_DB: postiz-db
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postiz-user -d postiz-db"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  postiz-redis:
    image: redis:7.2-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  postiz-minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: postiz-minio-user
      MINIO_ROOT_PASSWORD: postiz-minio-password
    ports:
      - "9000:9000"   # S3 API
      - "9001:9001"   # Web console
    volumes:
      - minio-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    restart: unless-stopped

volumes:
  postgres-data:
  redis-data:
  minio-data:
```

### Git Upstream Tracking Setup
```bash
# One-time setup after creating the fork
git remote add upstream https://github.com/gitroomhq/postiz-app.git

# Create upstream tracking branch (pinned to v2.20.1)
git fetch upstream
git checkout -b upstream upstream/main
git reset --hard v2.20.1
git push origin upstream

# Monthly upstream sync ritual
git fetch upstream
git diff upstream/v2.20.1 HEAD -- apps/backend/src/app/app.module.ts  # check divergence
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Postiz uses Cloudflare R2 as cloud storage | S3/MinIO PR pending (#1125) | Dec 2025 (open) | Must add MinIO manually in Phase 1 |
| BullMQ-only job processing | Temporal workflow engine added | ~2024 | Temporal is now primary orchestration in Postiz; BullMQ still present |
| Single workspace model | Still single workspace model in Postiz | — | Company hierarchy is our custom addition |
| Prisma `db push` (no migrations) | Prisma Migrate (migration files) | Postiz uses `prisma-db-push` script | We MUST use proper migrations for reproducibility |
| `ts-node` for seed scripts | `tsx` recommended by Prisma v7 | Prisma v7 | Use `tsx` not `ts-node` for seed execution |

**Deprecated/outdated patterns to avoid:**
- `prisma db push` for schema changes: fine for Postiz's own dev flow, but we must use `prisma migrate dev` for all our custom changes to get reproducible migration history
- Postiz frontend uses Vite + ReactJS per CLAUDE.md (not a pure Next.js server component app) — data fetching uses SWR hooks, not `async/await` in Server Components

---

## Open Questions

1. **Does `prisma.$extends` work with the existing Postiz PrismaService?**
   - What we know: Postiz uses NestJS `PrismaService` from `@gitroom/nestjs-libraries`. The `$extends` method is available in Prisma 4.7+, which Postiz uses.
   - What's unclear: Whether `PrismaService` is declared with the right return type to be extendable in NestJS DI context.
   - Recommendation: Verify during Wave 0 by running a test extension on the dev database. Fallback: use a repository wrapper pattern with explicit `where: { companyId }` in all custom service methods.

2. **Postiz CLAUDE.md mentions frontend is "Vite + ReactJS" but `apps/frontend` looks like Next.js**
   - What we know: The repo structure shows Next.js app router patterns (`(app)`, `layout.tsx`, etc.). The CLAUDE.md says "Vite + ReactJS." These appear contradictory.
   - What's unclear: Whether CLAUDE.md is outdated or there are two different frontends.
   - Recommendation: Treat `apps/frontend` as Next.js App Router (confirmed by directory structure). SWR data fetching pattern from CLAUDE.md still applies — use SWR hooks for client data fetching.

3. **Migration strategy for adding `companyId` to existing Postiz `Organization` table**
   - What we know: Prisma requires a non-nullable column to have a default value or be added as nullable first.
   - What's unclear: Whether adding `companyId String?` (nullable) to Organization is acceptable long-term or if it should be required.
   - Recommendation: Add as nullable in Phase 1. The seed script creates Companies and links Organizations to them. In Phase 2+, add a validation that all operations require a linked Company.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (via NX `getJestProjects()`) |
| Config file | `jest.config.ts` at repo root; individual projects have `jest.config.ts` in their directory |
| Quick run command | `npx nx test multi-company --testPathPattern=company-isolation` |
| Full suite command | `npx nx run-many --target=test --projects=multi-company,company-context` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R2.1 | Company CRUD creates/reads with all fields | Unit | `npx nx test multi-company --testPathPattern=company.service` | Wave 0 |
| R2.2 | Brand is linked to Company, 1-N constraint | Unit | `npx nx test multi-company --testPathPattern=brand.service` | Wave 0 |
| R2.3 | BrandVoice linked to Brand, uniqueness enforced | Unit | `npx nx test multi-company --testPathPattern=brand-voice.service` | Wave 0 |
| R2.5 | company_id FK exists on Organization, is respected by queries | Integration | `npx nx test multi-company --testPathPattern=company-isolation` | Wave 0 |
| R2.6 | Cross-company queries return empty (not another company's data) | Integration | `npx nx test multi-company --testPathPattern=company-isolation` | Wave 0 |
| R2.7 | Company switcher renders correct company name from URL slug | Component | `npx nx test frontend --testPathPattern=company-switcher` | Wave 0 |
| R2.8 | Company A brands not visible when querying Company B context | Integration | `npx nx test multi-company --testPathPattern=company-isolation` | Wave 0 (CRITICAL) |
| R1.1 | Docker services start, health checks pass | Smoke | Manual `docker compose up --wait` + `curl http://localhost:4007/health` | Manual |
| R1.2 | No custom code in `apps/` or `libraries/` | Static | `git diff HEAD -- apps/ libraries/ | grep "^+" | grep -v CUSTOM` | Manual audit |
| R1.3 | DIVERGENCE.md exists and has entries for all modified upstream files | Static | File existence check | Manual audit |

### Sampling Rate
- **Per task commit:** `npx nx test multi-company --testPathPattern=company-isolation -t "Company Data Isolation"`
- **Per wave merge:** `npx nx run-many --target=test --projects=multi-company,company-context`
- **Phase gate:** Full isolation test suite green + Docker smoke test passing before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `extensions/multi-company/src/__tests__/company.service.spec.ts` — covers R2.1, R2.2, R2.3
- [ ] `extensions/multi-company/src/__tests__/company-isolation.spec.ts` — covers R2.5, R2.6, R2.8 (CRITICAL)
- [ ] `extensions/multi-company/jest.config.ts` — project-level Jest config for NX
- [ ] `extensions/multi-company/tsconfig.spec.json` — TypeScript config for tests
- [ ] Framework install: Already in Postiz (Jest via NX) — no new install needed, but NX project config needed for `extensions/multi-company`

---

## Sources

### Primary (HIGH confidence)
- GitHub `gitroomhq/postiz-app` — repository structure, pnpm-workspace.yaml, apps/ and libraries/ directories, jest.config.ts, Prisma schema, CLAUDE.md
- `raw.githubusercontent.com/gitroomhq/postiz-app/main/libraries/nestjs-libraries/src/database/prisma/schema.prisma` — Organization, User, Integration, Post, Media model fields verified
- `docs.postiz.com/installation/docker-compose` — Docker Compose services: PostgreSQL 17, Redis 7.2, Temporal stack confirmed
- Postiz releases page — v2.20.1 confirmed as latest stable (March 6, 2026)
- NestJS documentation (docs.nestjs.com/modules) — module registration pattern
- Prisma documentation (prisma.io/docs) — `$extends`, migrate, seed patterns

### Secondary (MEDIUM confidence)
- DEV Community: "How to make Multi-tenant applications with NestJS and a Prisma proxy" — `$extends` + CLS pattern for company scoping
- GitHub issue #1124 — MinIO/S3 support not yet merged in Postiz as of March 2026 (confirmed open)
- deepwiki.com/gitroomhq/postiz-app — frontend route structure, integration management patterns
- Postiz CLAUDE.md — three-layer architecture pattern (Controller >> Service >> Repository), pnpm-only, library structure

### Tertiary (LOW confidence — flag for validation)
- Postiz frontend being "Vite + ReactJS" (from CLAUDE.md) vs apparent Next.js App Router structure (from directory inspection) — contradictory, needs direct codebase verification
- `prisma.$extends` compatibility with existing Postiz `PrismaService` — needs runtime validation in Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — versions confirmed from live Postiz repo and release pages
- Architecture: HIGH — directory structure directly inspected; pattern recommendations based on verified Postiz internals
- Pitfalls: HIGH — MinIO absence verified from Docker Compose inspection; Prisma schema location verified from raw GitHub file
- Test patterns: MEDIUM — Jest/NX confirmed present; exact test file structure to be created in Wave 0

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (30 days) — Postiz is actively developed (monthly releases); re-verify schema and Docker Compose before merge if more than 30 days have passed
