# Phase 1: Fork & Foundation - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Fork Postiz, set up local Docker Compose dev environment, establish extension architecture for custom code, extend Prisma schema with multi-company data model (Company, Brand, BrandVoice, SocialAccount), add company_id FK on relevant tables, build company CRUD + company switcher UI, create automated data isolation tests, and seed database with test companies.

</domain>

<decisions>
## Implementation Decisions

### Fork & Upstream Strategy
- Stay close to upstream Postiz — minimize modifications to upstream files
- Custom code in separate packages/directories (extension zone), not scattered across upstream files
- Maintain DIVERGENCE.md logging every upstream file modification with reason
- Keep an `upstream` git branch for easy diff comparison against upstream changes
- Pin fork to latest stable Postiz release (not bleeding-edge main)

### Extension Architecture
- Separate packages directory alongside Postiz packages for custom NestJS modules and Next.js pages/components
- Upstream files modified only when absolutely necessary (e.g., adding imports, route registrations)
- Every upstream modification logged in DIVERGENCE.md with file path, change description, and reason

### Company/Brand Hierarchy
- Companies can have 1-N brands — model supports both simple (1 brand) and multi-brand companies
- Company entity fields: name, slug, timezone, default language, industry, website, logo, notes (business context for AI)
- Brand entity: name, slug, logo, description, linked to Company
- BrandVoice: structured fields (tone, target audience, preferred hashtags, blacklisted words, sample posts, language) PLUS free-form notes field for nuanced guidance
- SocialAccount belongs to Brand (not Company directly) — each brand has its own social accounts

### Company Switcher UX
- Header dropdown switcher (like Slack workspace switcher) — always visible in top navigation
- Switching companies stays on the same page (e.g., posts view shows new company's posts)
- Single-company scoping in Phase 1 — cross-company summary is a Phase 7 dashboard concern
- URL-scoped: company slug in URL path (e.g., /acme/posts, /acme/media) for bookmarkability and clear context

### Seed Data
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

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key principle from PROJECT.md: maintainability is critical, custom modifications should be structured to allow merging upstream updates.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing codebase yet — this is the first phase, starting from a fresh fork

### Established Patterns
- Postiz uses: TypeScript, NestJS (backend), Next.js (frontend), Prisma (ORM), PostgreSQL, Redis, BullMQ
- These patterns will be established by the fork and serve as the baseline for all subsequent phases

### Integration Points
- Docker Compose environment: PostgreSQL, Redis, MinIO, app services
- Prisma schema: will be extended with Company, Brand, BrandVoice, SocialAccount models
- Next.js routing: will need company-scoped route structure
- NestJS modules: custom modules for company management

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-fork-and-foundation*
*Context gathered: 2026-03-10*
