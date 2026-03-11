---
phase: 06-scheduling-publishing-engine
plan: 05
subsystem: ui
tags: [react, nextjs, swr, tailwind, calendar, scheduling]

# Dependency graph
requires:
  - phase: 06-04
    provides: SchedulingController, FailedPostsController API endpoints (calendar, failed-posts, schedule, retry, auto-slot)

provides:
  - Scheduling calendar page at /scheduling with week/day toggle
  - SWR hook for calendar data (useScheduledPosts)
  - SWR hook for failed posts (useFailedPosts)
  - Mutation hook for scheduling actions (useScheduleActions)
  - PostCard component with platform color coding
  - CalendarDayCell component with overflow indicator
  - SchedulePostForm modal with datetime-local input and auto-slot
  - FailedPostsPanel with platform filter, error details, retry action

affects:
  - 07-analytics-dashboard

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "SWR hook per query in separate file (CLAUDE.md compliance)"
    - "Mutation hook (useFetch only, no SWR) for write operations"
    - "Platform color coding: instagram=pink-500, facebook=blue-600, linkedin=sky-500, x=gray-600"
    - "Native calendar grid with CSS grid-cols-7 (no npm calendar library)"
    - "datetime-local native input for date/time selection"

key-files:
  created:
    - apps/frontend/src/components/scheduling/use-scheduled-posts.ts
    - apps/frontend/src/components/scheduling/use-failed-posts.ts
    - apps/frontend/src/components/scheduling/use-schedule-actions.ts
    - apps/frontend/src/components/scheduling/post-card.tsx
    - apps/frontend/src/components/scheduling/calendar-day-cell.tsx
    - apps/frontend/src/components/scheduling/scheduling-calendar.tsx
    - apps/frontend/src/components/scheduling/schedule-post-form.tsx
    - apps/frontend/src/components/scheduling/failed-posts-panel.tsx
    - apps/frontend/src/app/(app)/(site)/scheduling/page.tsx
  modified: []

key-decisions:
  - "Route at (app)/(site)/scheduling — project uses this pattern, not (dashboard)/ as specified in plan"
  - "PostCard import added explicitly in DayView sub-component (TypeScript scope requirement)"
  - "CalendarDayCell shows first variant of each post to avoid layout explosion"
  - "DayView slots 6am-11pm (18 hours) for practical scheduling range"

patterns-established:
  - "SWR key: string key pattern (cache-${slug}-${params}) to enable selective invalidation"
  - "useScheduleActions returns plain functions (not SWR), caller calls mutate() after each action"

requirements-completed:
  - R9.3
  - R10.7

# Metrics
duration: 15min
completed: 2026-03-11
---

# Phase 6 Plan 05: Scheduling Frontend UI Summary

**React scheduling calendar UI with week/day views, SWR data hooks, schedule form with auto-slot, and failed posts panel with retry — all built natively without npm component libraries**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-10T23:58:19Z
- **Completed:** 2026-03-11T00:13:00Z
- **Tasks:** 1 (+ 1 auto-approved checkpoint)
- **Files modified:** 9

## Accomplishments

- Scheduling calendar page at `/scheduling` with week/day view toggle and navigation
- Platform color-coded post cards (instagram=pink, facebook=blue, linkedin=sky, x=gray)
- Schedule form modal with native datetime-local picker and auto-slot API integration
- Failed posts panel with per-platform filtering, error message display, and retry button
- All four SWR/action hooks wired to correct Phase 6 Plan 4 backend endpoints
- TypeScript compiles cleanly with zero errors

## Task Commits

Each task was committed atomically:

1. **Task 1: SWR hooks, calendar components, schedule form, and failed posts panel** - `c2a92535` (feat)
2. **Task 2: Visual verification checkpoint** - auto-approved (auto_advance=true)

**Plan metadata:** (committed below)

## Files Created/Modified

- `apps/frontend/src/components/scheduling/use-scheduled-posts.ts` - SWR hook for GET /calendar endpoint with typed CalendarResponse
- `apps/frontend/src/components/scheduling/use-failed-posts.ts` - SWR hook for GET /failed-posts with platform/page params
- `apps/frontend/src/components/scheduling/use-schedule-actions.ts` - Mutation hook for schedule/autoSlot/cancel/retry
- `apps/frontend/src/components/scheduling/post-card.tsx` - Compact card with platform color bar, caption preview, time, status badge
- `apps/frontend/src/components/scheduling/calendar-day-cell.tsx` - Day cell with date number, max-3 post cards, +N overflow
- `apps/frontend/src/components/scheduling/scheduling-calendar.tsx` - Main calendar with week/day toggle, navigation, skeleton loading
- `apps/frontend/src/components/scheduling/schedule-post-form.tsx` - Modal form with datetime-local input, auto-slot, cancel schedule
- `apps/frontend/src/components/scheduling/failed-posts-panel.tsx` - Panel with platform filter, error details, retry per variant
- `apps/frontend/src/app/(app)/(site)/scheduling/page.tsx` - Route page wiring calendar, schedule form, and failed posts panel

## Decisions Made

- Route path corrected from `(dashboard)/` to `(app)/(site)/` — matches actual Postiz route group structure discovered during implementation
- PostCard explicitly imported in scheduling-calendar.tsx to fix TypeScript scope issue in DayView sub-component
- CalendarDayCell shows first variant per post to keep cells compact (multi-variant posts click through to schedule form)
- DayView covers 6am–11pm (18-hour slots) as practical scheduling window

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Route path corrected from (dashboard)/ to (app)/(site)/**
- **Found during:** Task 1 (page route creation)
- **Issue:** Plan specified `apps/frontend/src/app/(dashboard)/scheduling/page.tsx` but this route group does not exist in Postiz; all dashboard routes use `(app)/(site)/`
- **Fix:** Created page at `apps/frontend/src/app/(app)/(site)/scheduling/page.tsx` matching actual project structure
- **Files modified:** apps/frontend/src/app/(app)/(site)/scheduling/page.tsx
- **Verification:** TypeScript compiles cleanly; route follows same pattern as /media, /analytics, /settings pages
- **Committed in:** c2a92535 (Task 1 commit)

**2. [Rule 1 - Bug] PostCard import missing in DayView sub-component**
- **Found during:** Task 1 verification (tsc --noEmit)
- **Issue:** DayView uses PostCard but import was only in scheduling-calendar.tsx module scope — TypeScript error TS2304 Cannot find name 'PostCard'
- **Fix:** Added explicit `import { PostCard } from './post-card'` at top of scheduling-calendar.tsx
- **Files modified:** apps/frontend/src/components/scheduling/scheduling-calendar.tsx
- **Verification:** `npx tsc --noEmit` exits with 0 errors
- **Committed in:** c2a92535 (Task 1 commit, fixed before commit)

---

**Total deviations:** 2 auto-fixed (1 blocking route path, 1 TypeScript bug)
**Impact on plan:** Both essential corrections — no scope creep, plan intent fully delivered.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None — no external service configuration required. Backend endpoints were implemented in Plan 04.

## Next Phase Readiness

- Phase 6 complete: all 5 plans done (models, scheduler, adapters, backend controllers, frontend UI)
- Phase 7 Analytics & Dashboard can begin — scheduling data flows are established
- No blockers

---
*Phase: 06-scheduling-publishing-engine*
*Completed: 2026-03-11*
