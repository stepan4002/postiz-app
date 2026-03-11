---
phase: 06-scheduling-publishing-engine
plan: 03
subsystem: api
tags: [instagram, facebook, linkedin, x, twitter, meta, graph-api, oauth1a, platform-adapter, social-publishing]

# Dependency graph
requires:
  - phase: 06-scheduling-publishing-engine
    plan: 01
    provides: "PlatformAdapter interface, PublishParams, PublishResult, ErrorClassification types in publishing.types.ts"

provides:
  - "BaseAdapter abstract class with error classification (rate_limit/transient/permanent), fetchWithTimeout, and buildPublishResult helpers"
  - "InstagramAdapter: 2-step Meta container publish pattern (create container, poll FINISHED, publish) with pinned API v21.0"
  - "FacebookAdapter: Graph API text and photo post creation with pinned API v21.0"
  - "LinkedInAdapter: REST API UGC post with YYYYMM versioned header (202501), image upload via initializeUpload flow"
  - "XAdapter: Tweet creation via API v2 with OAuth 1.0a HMAC-SHA1 signing, composite token:secret pattern"
  - "AdapterRegistry: maps platform string to adapter instance, throws on unknown platform"
  - "platformAccountId field added to PublishParams for page/user ID scoping"

affects:
  - "06-04 (publishing worker — uses AdapterRegistry.getAdapter() for runtime lookup)"
  - "06-05 (orchestration — adapters are the leaf-level publish callers)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "2-step container publish pattern for Instagram (create -> poll FINISHED -> publish)"
    - "OAuth 1.0a HMAC-SHA1 signature generation with composite token:secret splitting"
    - "YYYYMM API version format for LinkedIn (202501)"
    - "Error classification via BaseAdapter.classifyError(): 429=rate_limit, 5xx=transient, other 4xx=permanent"
    - "Registry pattern: AdapterRegistry maps platform string to adapter, throws on unknown"

key-files:
  created:
    - "extensions/scheduling-publishing/src/adapters/base.adapter.ts"
    - "extensions/scheduling-publishing/src/adapters/instagram.adapter.ts"
    - "extensions/scheduling-publishing/src/adapters/facebook.adapter.ts"
    - "extensions/scheduling-publishing/src/adapters/linkedin.adapter.ts"
    - "extensions/scheduling-publishing/src/adapters/x.adapter.ts"
    - "extensions/scheduling-publishing/src/adapters/adapter-registry.ts"
    - "extensions/scheduling-publishing/src/__tests__/instagram.adapter.spec.ts"
    - "extensions/scheduling-publishing/src/__tests__/facebook.adapter.spec.ts"
    - "extensions/scheduling-publishing/src/__tests__/linkedin.adapter.spec.ts"
    - "extensions/scheduling-publishing/src/__tests__/x.adapter.spec.ts"
  modified:
    - "extensions/scheduling-publishing/src/types/publishing.types.ts (added platformAccountId to PublishParams)"
    - "extensions/scheduling-publishing/src/index.ts (added adapter + registry exports)"

key-decisions:
  - "platformAccountId added to PublishParams: page-scoped adapters (Instagram, Facebook, LinkedIn) need account/page ID separate from accessToken"
  - "Instagram text-only returns permanent error: Meta Business API requires media — not retryable"
  - "Instagram polls container status up to 15 attempts (30s max at 2s intervals) before giving up with transient error"
  - "Facebook photo posts go to /{page-id}/photos, text-only to /{page-id}/feed — same adapter handles both"
  - "LinkedIn uses x-restli-id response header as post URN (platformPostId)"
  - "X OAuth 1.0a splits composite 'token:secret' accessToken to extract oauth_token and oauth_token_secret"
  - "X upload.x.com used for media upload (v1.1 endpoint); api.x.com/2/tweets for tweet creation (v2)"
  - "AdapterRegistry constructor eagerly instantiates all 4 adapters — no lazy loading needed at this scale"
  - "BaseAdapter.classifyError(statusCode, responseBody) is the single authority for error classification across all adapters"

patterns-established:
  - "Adapter TDD pattern: write failing tests first (RED), then implement to pass (GREEN)"
  - "All platform-specific API logic lives in the adapter class, never leaks out (NF4.3)"
  - "Each adapter declares readonly platform and apiVersion (NF4.5)"
  - "fetch() is spied on with jest.spyOn(global, 'fetch') for deterministic test mocking"
  - "Error classification shared via BaseAdapter — not duplicated across adapters"

requirements-completed: [R10.2, R10.3, R10.5, NF4.3, NF4.5]

# Metrics
duration: 18min
completed: 2026-03-10
---

# Phase 6 Plan 03: Platform Adapter Layer Summary

**4 platform adapters (Instagram, Facebook, LinkedIn, X) with uniform PlatformAdapter interface, error classification, and AdapterRegistry for runtime platform lookup**

## Performance

- **Duration:** 18 min
- **Started:** 2026-03-10T23:28:29Z
- **Completed:** 2026-03-10T23:46:00Z
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Implemented all 4 MVP platform adapters (Instagram, Facebook, LinkedIn, X) on top of shared BaseAdapter
- Established uniform error classification (rate_limit / transient / permanent) across all adapters via BaseAdapter.classifyError()
- Created AdapterRegistry providing O(1) runtime lookup of adapter by platform name
- 29 adapter tests passing across all 4 platform test suites (exceeds 22+ required)

## Task Commits

Each task was committed atomically:

1. **Task 1: Base adapter and Instagram + Facebook adapters** - `85b10a54` (feat)
2. **Task 2: LinkedIn + X adapters and AdapterRegistry** - `eb6950fe` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks — tests written first (RED), then implementation (GREEN) per TDD protocol._

## Files Created/Modified

- `extensions/scheduling-publishing/src/adapters/base.adapter.ts` - Abstract BaseAdapter with classifyError(), buildPublishResult(), fetchWithTimeout()
- `extensions/scheduling-publishing/src/adapters/instagram.adapter.ts` - 2-step Meta container publish: create container, poll FINISHED status (30s max), publish container
- `extensions/scheduling-publishing/src/adapters/facebook.adapter.ts` - Graph API text feed (/feed) and photo (/photos) post creation
- `extensions/scheduling-publishing/src/adapters/linkedin.adapter.ts` - LinkedIn REST API UGC post with YYYYMM versioned header, image upload via initializeUpload + PUT
- `extensions/scheduling-publishing/src/adapters/x.adapter.ts` - X API v2 tweet creation with OAuth 1.0a HMAC-SHA1 signing, composite token:secret pattern
- `extensions/scheduling-publishing/src/adapters/adapter-registry.ts` - Registry mapping platform string to adapter instance, getSupportedPlatforms(), throws on unknown
- `extensions/scheduling-publishing/src/__tests__/instagram.adapter.spec.ts` - 7 tests covering container flow, error types, text-only rejection
- `extensions/scheduling-publishing/src/__tests__/facebook.adapter.spec.ts` - 7 tests covering /feed, /photos, error classification, platformUrl format
- `extensions/scheduling-publishing/src/__tests__/linkedin.adapter.spec.ts` - 6 tests covering UGC posts, media upload flow, LinkedIn-Version header
- `extensions/scheduling-publishing/src/__tests__/x.adapter.spec.ts` - 9 tests covering tweets, media upload, OAuth 1.0a header, AdapterRegistry
- `extensions/scheduling-publishing/src/types/publishing.types.ts` - Added platformAccountId to PublishParams
- `extensions/scheduling-publishing/src/index.ts` - Added adapter and registry exports

## Decisions Made

- **platformAccountId in PublishParams:** Instagram and Facebook require a page/user ID separate from the access token. Added as optional field to avoid breaking interface changes.
- **Instagram text-only = permanent error:** Meta Business API requires media. Returning permanent/non-retryable avoids infinite retry loops.
- **X OAuth 1.0a composite token:** `accessToken` is stored as `"token:secret"` per Phase 2 decision. Adapter splits on first colon to extract both parts.
- **AdapterRegistry eager instantiation:** All 4 adapters instantiated in constructor — clean, predictable, no lazy-loading complexity at this scale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added platformAccountId to PublishParams**
- **Found during:** Task 1 (Instagram adapter implementation)
- **Issue:** Plan mentioned adding platformAccountId but it was listed as an implementation note within the task, not a separate type update. The field was required by both Instagram and Facebook adapters to know which account to publish to.
- **Fix:** Added `platformAccountId?: string` to PublishParams interface with clear JSDoc explaining which adapters use it and what values are expected.
- **Files modified:** `extensions/scheduling-publishing/src/types/publishing.types.ts`
- **Verification:** All adapter tests reference platformAccountId and pass
- **Committed in:** `85b10a54` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 2 - missing critical field)
**Impact on plan:** Required for correct operation. The plan mentioned this change in the task action section — it was always intended, just needed explicit tracking.

## Issues Encountered

- Pre-existing failing tests in `schedule-resolver.service.spec.ts` (2 tests related to timezone-sensitive UTC assertions from a prior plan). These are out of scope for this plan — documented in deferred-items.

## User Setup Required

None - no external service configuration required. Platform API credentials (X_CLIENT_ID, X_CLIENT_SECRET, Meta App credentials) are already documented in .env.example from prior plans.

## Next Phase Readiness

- AdapterRegistry ready for injection into the publishing worker (Plan 06-04)
- All 4 platform adapters implement the uniform PlatformAdapter interface
- Error classification is consistent — publishing worker can use errorType and retryable directly for retry scheduling
- platformAccountId must be provided at publish time from the SocialAccount record

---
*Phase: 06-scheduling-publishing-engine*
*Completed: 2026-03-10*
