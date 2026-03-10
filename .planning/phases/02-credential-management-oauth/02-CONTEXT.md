# Phase 2: Credential Management & OAuth - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Operator can connect Instagram, Facebook, LinkedIn, and X accounts to any company/brand, with encrypted token storage and proactive refresh. Includes OAuth connect flows for 4 platforms, token encryption at rest, proactive token refresh background job, token health tracking, Meta parent-child token management, and health alerts surfaced in dashboard.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation details were deferred to Claude's discretion. The following areas were discussed, and Claude should choose the best approach for each based on security, upstream compatibility, and operational simplicity:

**Token Encryption:**
- Encryption approach: AES-256-CBC (reuse AuthService.fixedEncryption) vs AES-256-GCM (new implementation) — choose based on security vs complexity
- Token storage model: extend existing Integration model at service layer vs new PlatformCredential entity in extension zone — choose based on upstream compatibility
- Migration strategy: migrate all existing plaintext tokens vs encrypt only new tokens — choose based on what's practical
- Key management: reuse JWT_SECRET vs separate ENCRYPTION_KEY env var — choose based on security vs operational simplicity

**OAuth Flow Integration:**
- Integration approach: wrap upstream Postiz OAuth providers with company/brand context middleware vs fork providers into extension zone — minimize upstream divergence
- Connect UX: brand settings page flow (Company → Brand → Connect) vs global connect + assign to brand
- Meta parent-child tokens: store user token and derive page tokens vs one token per page directly — follow how Meta API actually works
- Account exclusivity: each social account exclusive to one brand vs shared across brands — choose based on data model clarity

**Token Refresh Strategy:**
- Job mechanism: BullMQ recurring job vs NestJS @Cron decorator vs Temporal workflow — choose based on existing infrastructure (BullMQ already in use, Temporal deferred to Phase 6)
- Refresh failure handling: alert operator with days remaining vs auto-disable and alert — choose right balance of safety vs convenience
- Failure threshold: 3 consecutive failures vs immediate alert — choose sensible threshold
- Configuration scope: system-wide vs per-company — choose what makes sense for solo operator

**Token Health & Alerts:**
- Health UI placement: dashboard banner + settings page vs inline on connected accounts only — choose right visibility level
- Health states: 3-state (Healthy/Warning/Expired) vs 4-state (add Refreshing) — choose right granularity
- Health data detail: summary only (lastRefreshedAt, expiresAt, consecutiveFailures) vs full attempt log — choose what's useful for solo operator
- Notification mechanism: dashboard UI only vs add email notifications — choose what's appropriate for Milestone 1

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraints from prior phases and project context:

- Extension zone architecture: custom code in `extensions/`, upstream files modified minimally (DIVERGENCE.md tracking)
- SocialAccount belongs to Brand (not Company directly) — Phase 1 hierarchy decision
- Company API scoping: explicit companyId parameter, not CLS magic — Phase 1 decision
- Solo operator: no multi-user complexity, one person manages everything
- Phase 1 decided: no Temporal until Phase 6 (dev compose is lightweight: PostgreSQL + Redis + MinIO only)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AuthService.fixedEncryption()` / `fixedDecryption()`: AES-256-CBC encryption using JWT_SECRET (libraries/helpers/src/auth/auth.service.ts)
- `SocialAbstract` base class: all social providers extend this with `generateAuthUrl()`, callback handling, error handling (libraries/nestjs-libraries/src/integrations/social.abstract.ts)
- Existing OAuth providers: `FacebookProvider`, `InstagramProvider` (+ standalone), `LinkedinProvider` (+ page), `XProvider` — all in libraries/nestjs-libraries/src/integrations/social/
- `Integration` Prisma model: stores token, refreshToken, tokenExpiration, organizationId, type, providerIdentifier (schema.prisma)
- BullMQ: already used for background jobs throughout the codebase
- Extension zone packages: `extensions/company-context`, `extensions/multi-company`, `extensions/seed`

### Established Patterns
- NestJS module registration: custom modules registered in AppModule
- Controller → Service → Repository layering (no shortcuts)
- Prisma as ORM, PrismaRepository pattern for data access
- Facebook/Instagram providers already handle Meta-specific token flows (page selection as "isBetweenSteps")
- Token error handling: providers return `{ type: 'refresh-token', value: 'Please re-authenticate' }` on token issues — no proactive refresh exists

### Integration Points
- Company/Brand/SocialAccount entities: created in Phase 1, Integration needs linking to Brand via SocialAccount
- Organization → Company relationship: Integration currently linked to Organization, needs company context
- Dashboard: token health alerts will surface here (Phase 7 builds full dashboard, but Phase 2 needs basic alert UI)
- Frontend connected accounts page: currently at organization level, needs brand-scoped version

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-credential-management-oauth*
*Context gathered: 2026-03-10*
