---
phase: 02-credential-management-oauth
plan: 05
subsystem: ui
tags: [react, swr, tailwind, oauth, brand-connect, credential-health, env-config]

# Dependency graph
requires:
  - phase: 02-credential-management-oauth
    plan: 03
    provides: POST /api/credentials/oauth/start and /api/credentials/oauth/callback (OAuthBrandController)
  - phase: 02-credential-management-oauth
    plan: 04
    provides: useTokenHealth hook, TokenHealthBanner, TokenHealthList components

provides:
  - "BrandConnectPanel React component: 2-column grid of Instagram/Facebook/LinkedIn/X platform cards with connect/health state"
  - "useBrandConnections(brandId) SWR hook: per-brand platform connection state"
  - "credential-health/index.ts barrel: exports all components and hooks as a unified module"
  - ".env.example updated: ENCRYPTION_KEY, META_APP_ID/META_APP_SECRET, OAuth callback URL comments"

affects:
  - Phase 3 (AI service layer may display connection status in UI)
  - Phase 7 (Analytics dashboard may embed BrandConnectPanel in brand settings)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BrandConnectPanel uses native fetch (not useFetch) for POST OAuth start — redirect to external OAuth URL requires full URL, not relative path"
    - "MVP_PLATFORMS constant as readonly tuple ensures exhaustive platform card rendering"
    - "Platform-specific SVG icons defined inline in component — no external icon library"
    - "connectionMap derived from SWR data for O(1) platform lookup in render"

key-files:
  created:
    - apps/frontend/src/components/credential-health/useBrandConnections.ts
    - apps/frontend/src/components/credential-health/BrandConnectPanel.tsx
    - apps/frontend/src/components/credential-health/index.ts
  modified:
    - .env.example

key-decisions:
  - "BrandConnectPanel uses native fetch for OAuth start POST — useFetch uses relative API URLs; the OAuth redirect needs to go to a social provider external URL returned in the response body, so native fetch is correct here"
  - "useBrandConnections hook fetches from /credentials/brand-connections/{brandId} — endpoint path designed to align with plan interfaces; returns empty array when brandId is falsy (null guard in SWR key)"
  - "ENCRYPTION_KEY placed in Required Settings section of .env.example — it is required for the credential management extension to start (throws at startup if missing)"
  - "META_APP_ID/META_APP_SECRET added alongside FACEBOOK_APP_ID — Meta Business API uses its own app credentials separate from the standard Facebook OAuth flow"

patterns-established:
  - "Platform card pattern: icon + label header, conditional connected/disconnected state body, health dot when connected"
  - "Connect button flow: POST /api/credentials/oauth/start -> window.location.href = returned URL"
  - "Barrel index.ts in credential-health: exports all components + hooks + types for clean imports from other modules"

requirements-completed: [R3.1, R3.6]

# Metrics
duration: 15min
completed: 2026-03-10
---

# Phase 2 Plan 05: BrandConnectPanel and Environment Variable Documentation Summary

**BrandConnectPanel with 4 MVP platform cards (Instagram, Facebook, LinkedIn, X), useBrandConnections SWR hook, credential-health barrel export, and .env.example updated with ENCRYPTION_KEY and Meta OAuth app credentials**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-10T17:00:00Z
- **Completed:** 2026-03-10T17:15:00Z
- **Tasks:** 1 (+ 1 auto-approved checkpoint)
- **Files modified:** 4

## Accomplishments

- Created `useBrandConnections(brandId)` SWR hook following project rules-of-hooks pattern with null-safe key, returning `{ connections, isLoading, error, mutate }` per brand
- Created `BrandConnectPanel` with 2-column responsive grid of PlatformCard sub-components for Instagram, Facebook, LinkedIn, and X — each showing connected state with health dot, display name, and "Manage connection" link, or "Connect" button initiating OAuth via `POST /api/credentials/oauth/start` -> `window.location.href`
- Created `index.ts` barrel exporting all credential-health components, hooks, and types from a single module entry point
- Updated `.env.example` with `ENCRYPTION_KEY` (documented in Required Settings with generation command), `META_APP_ID`/`META_APP_SECRET` (with dashboard setup instructions), and OAuth callback URL comments for all 4 MVP platforms

## Task Commits

Each task was committed atomically:

1. **Task 1: Brand connect panel, SWR hook, index barrel, env.example** - `695aad2e` (feat)

**Plan metadata:** (included in final docs commit)

## Files Created/Modified

- `apps/frontend/src/components/credential-health/useBrandConnections.ts` - SWR hook returning per-brand platform connections with health state; null-safe brandId key
- `apps/frontend/src/components/credential-health/BrandConnectPanel.tsx` - Connect panel with 2-col grid, PlatformCard sub-component, connect button OAuth initiation, error banner, loading skeleton
- `apps/frontend/src/components/credential-health/index.ts` - Barrel export for all credential-health components, hooks, and TypeScript types
- `.env.example` - Added ENCRYPTION_KEY (Required Settings), META_APP_ID/META_APP_SECRET, OAuth callback URL comments for X/LinkedIn/Meta

## Decisions Made

- **Native fetch for OAuth start POST**: The `useFetch` hook from `@gitroom/helpers` constructs relative API URLs. The OAuth start response returns an external social provider URL that must become `window.location.href`. Using native `fetch('/api/credentials/oauth/start', ...)` is correct here — no context provider needed for this specific fire-and-redirect call.
- **ENCRYPTION_KEY in Required Settings**: Placed above the optional settings block because `TokenEncryptionService` throws at NestJS startup if the env var is missing, making it truly required.
- **META_APP_ID separate from FACEBOOK_APP_ID**: The Meta Business API (for Instagram + Facebook) uses its own app credentials (`META_APP_ID`/`META_APP_SECRET`). The upstream Postiz `FACEBOOK_APP_ID`/`FACEBOOK_APP_SECRET` is for the legacy OAuth flow and kept for backward compatibility.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

The `user_setup` section in the plan frontmatter documents external service configuration required before the OAuth flows can be tested:

**Meta (Instagram + Facebook):**
- Create Meta App with Instagram Basic Display + Facebook Login permissions at developers.facebook.com
- Add OAuth redirect URI: `http://localhost:5000/api/integrations/social/facebook/callback`
- Set `META_APP_ID` and `META_APP_SECRET` from App Settings -> Basic

**LinkedIn:**
- Create LinkedIn App with Marketing API product at developer.linkedin.com
- Add redirect URI: `http://localhost:5000/api/integrations/social/linkedin/callback`
- Set `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` from App -> Auth tab

**X (Twitter):**
- Create X App with OAuth 1.0a enabled at developer.x.com
- Add callback URL: `http://localhost:5000/api/integrations/social/x/callback`
- Set `X_API_KEY` and `X_API_SECRET` from Project -> Keys and Tokens

**Token Encryption:**
- Generate: `openssl rand -hex 32`
- Set `ENCRYPTION_KEY` in `.env`

## Next Phase Readiness

- Phase 2 complete: all credential management infrastructure is in place (encryption, refresh cron, OAuth brand context, health API, frontend components)
- `BrandConnectPanel` ready to embed in brand settings page (requires routeing work in Phase 3+ or a standalone settings route)
- `TokenHealthBanner` and `TokenHealthList` ready to add to dashboard layout
- `CredentialManagementModule` registered in `AppModule` — Phase 3 can use `CredentialService` for AI provider token management

## Self-Check: PASSED

All created files verified present. Commit verified in git log.

- `apps/frontend/src/components/credential-health/useBrandConnections.ts` — FOUND
- `apps/frontend/src/components/credential-health/BrandConnectPanel.tsx` — FOUND
- `apps/frontend/src/components/credential-health/index.ts` — FOUND
- `.env.example` contains ENCRYPTION_KEY — FOUND
- `695aad2e` — FOUND

---
*Phase: 02-credential-management-oauth*
*Completed: 2026-03-10*
