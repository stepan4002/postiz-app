---
phase: 05-content-generation-pipeline
plan: 05
subsystem: ui
tags: [react, swr, typescript, tailwind, review-queue, content-generation]

# Dependency graph
requires:
  - phase: 05-03
    provides: "Review queue backend API (GET /companies/:slug/review-queue, POST approve/reject/regenerate, PATCH variant)"

provides:
  - "ReviewQueueList: paginated list component showing pending AI-generated posts"
  - "ReviewQueueItem: post card with variants, confidence badges, and action buttons"
  - "ConfidenceBadge: color-coded confidence score display (red/amber/green)"
  - "InlineCaptionEditor: inline textarea editor for variant captions"
  - "useReviewQueue: SWR hook for GET /companies/:slug/review-queue"
  - "useReviewAction: mutation hook for approve/reject/regenerate/editVariant"

affects: [06-scheduling-publishing-engine, review-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SWR hook per file per CLAUDE.md rules (useReviewQueue, useReviewAction in separate files)"
    - "useFetch for all API calls (not raw fetch or axios)"
    - "useCompany context for companySlug from ?c= URL param"
    - "Confidence score color coding: <0.5=red, 0.5-0.7=amber, >=0.7=green"
    - "isProcessing state disables all action buttons during mutation"

key-files:
  created:
    - apps/frontend/src/components/review-queue/hooks/use-review-queue.ts
    - apps/frontend/src/components/review-queue/hooks/use-review-action.ts
    - apps/frontend/src/components/review-queue/confidence-badge.tsx
    - apps/frontend/src/components/review-queue/inline-caption-editor.tsx
    - apps/frontend/src/components/review-queue/review-queue-item.tsx
    - apps/frontend/src/components/review-queue/review-queue-list.tsx
  modified: []

key-decisions:
  - "useReviewAction does not use SWR — mutations use useState(isLoading) + useFetch only"
  - "SWR mutate() called after every action so list refreshes without full page reload"
  - "companySlug sourced from useCompany context (reads ?c= URL param) not props"
  - "Platform badge colors: instagram=pink, facebook=blue, linkedin=sky, x=gray"
  - "Media thumbnail rendered only when both mediaId and MINIO_PUBLIC_URL are present"
  - "Inline editor per-variant: only one variant editable at a time (editingVariantId state)"

patterns-established:
  - "Review queue action pattern: setIsProcessing -> await action -> setIsProcessing(false) -> onActionComplete()"
  - "Per-variant editing: editingVariantId state controls which variant shows InlineCaptionEditor"

requirements-completed: [R6.3, R6.4]

# Metrics
duration: 4min
completed: 2026-03-10
---

# Phase 5 Plan 05: Review Queue UI Summary

**Operator review queue UI with SWR-driven post list, color-coded confidence badges, inline caption editor, and approve/reject/regenerate action buttons**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-10T22:17:22Z
- **Completed:** 2026-03-10T22:21:22Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- SWR hooks (useReviewQueue + useReviewAction) for data fetching and post mutations
- ReviewQueueList component with pagination, loading skeletons, and empty state
- ReviewQueueItem card displaying variants with captions, hashtags, confidence scores, and action buttons
- ConfidenceBadge with three-tier color coding (red/amber/green) matching CONTEXT.md spec
- InlineCaptionEditor allowing per-variant caption editing with Save & Approve / Cancel
- SWR mutate() called after every action (approve/reject/regenerate/editVariant) to refresh list

## Task Commits

Each task was committed atomically:

1. **Task 1: SWR hooks for review queue data and actions** - `9894ab30` (feat)
2. **Task 2: Review Queue UI components** - `97dc6297` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `apps/frontend/src/components/review-queue/hooks/use-review-queue.ts` - SWR hook: GET /companies/:slug/review-queue paginated
- `apps/frontend/src/components/review-queue/hooks/use-review-action.ts` - Mutation hook: approve/reject/regenerate/editVariant
- `apps/frontend/src/components/review-queue/confidence-badge.tsx` - Color-coded score badge (red/amber/green)
- `apps/frontend/src/components/review-queue/inline-caption-editor.tsx` - Textarea editor with Save & Approve / Cancel
- `apps/frontend/src/components/review-queue/review-queue-item.tsx` - Post card with variants, platform badges, action row
- `apps/frontend/src/components/review-queue/review-queue-list.tsx` - Main list with pagination and empty state

## Decisions Made

- `useReviewAction` uses `useState` + `useFetch` only (not SWR) — mutations don't need caching
- `SWR mutate()` called after every action — no full page reload needed
- `companySlug` comes from `useCompany()` context reading `?c=` URL param — consistent with company-switcher pattern
- Platform badge colors follow social platform brand conventions (pink/blue/sky/gray)
- Only one variant editable at a time via `editingVariantId` state — prevents conflicting edits
- Media thumbnail only rendered when `mediaId` exists and `MINIO_PUBLIC_URL` is set on window

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Pre-existing TypeScript error in `apps/frontend/src/components/content-generation/media-picker.tsx` (unrelated `import.meta.env` issue). Logged as out-of-scope — not introduced by this plan.

## User Setup Required

None - no external service configuration required. Components connect to backend endpoints from Plan 05-03.

## Next Phase Readiness

- Review Queue UI is complete and operator-ready
- Phase 6 (Scheduling & Publishing Engine) can reference ReviewQueueList as the entry point for approved content entering the scheduling pipeline
- ReviewQueueService (exported from ContentGenerationModule in Plan 05-03) is ready for Phase 6 consumption

---
*Phase: 05-content-generation-pipeline*
*Completed: 2026-03-10*
