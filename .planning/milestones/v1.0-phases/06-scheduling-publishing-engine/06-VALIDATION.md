---
phase: 6
slug: scheduling-publishing-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x / vitest |
| **Config file** | extensions/scheduling-publishing/jest.config.js (backend) + apps/frontend/vitest.config.ts (frontend) |
| **Quick run command** | `pnpm test -- --testPathPattern=scheduling-publishing` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- --testPathPattern=scheduling-publishing`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-T1 | 01 | 1 | R9.1, NF4.3, NF4.5 | unit | `cd extensions/scheduling-publishing && npx jest --config jest.config.ts --passWithNoTests` | post-state-machine.spec.ts | ⬜ pending |
| 06-01-T2 | 01 | 1 | R9.1 | schema | `DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy npx prisma validate --schema=libraries/nestjs-libraries/src/database/prisma/schema.prisma` | migration.sql | ⬜ pending |
| 06-02-T1 | 02 | 2 | R9.2, R9.3, R9.5 | unit | `cd extensions/scheduling-publishing && npx jest --config jest.config.ts --testPathPattern="schedule-resolver"` | schedule-resolver.service.spec.ts | ⬜ pending |
| 06-02-T2 | 02 | 2 | R9.4 | unit | `cd extensions/scheduling-publishing && npx jest --config jest.config.ts --testPathPattern="scheduler-tick"` | scheduler-tick.job.spec.ts | ⬜ pending |
| 06-03-T1 | 03 | 2 | R10.2, R10.3, R10.5, NF4.3, NF4.5 | unit | `cd extensions/scheduling-publishing && npx jest --config jest.config.ts --testPathPattern="(instagram\|facebook).adapter"` | instagram.adapter.spec.ts, facebook.adapter.spec.ts | ⬜ pending |
| 06-03-T2 | 03 | 2 | R10.2, R10.3, R10.5, NF4.3, NF4.5 | unit | `cd extensions/scheduling-publishing && npx jest --config jest.config.ts --testPathPattern="(linkedin\|x).adapter"` | linkedin.adapter.spec.ts, x.adapter.spec.ts | ⬜ pending |
| 06-04-T1 | 04 | 3 | R10.1, R10.4, R10.6, R10.8, NF2.1 | unit | `cd extensions/scheduling-publishing && npx jest --config jest.config.ts --testPathPattern="(publishing-worker\|publish-attempt)"` | publishing-worker.job.spec.ts, publish-attempt-logger.spec.ts | ⬜ pending |
| 06-04-T2 | 04 | 3 | R10.7 | compile | `npx tsc --noEmit -p extensions/scheduling-publishing/tsconfig.json` | scheduling.controller.ts, failed-posts.controller.ts, scheduling-publishing.module.ts | ⬜ pending |
| 06-05-T1 | 05 | 4 | R9.3, R10.7 | compile | `npx tsc --noEmit -p apps/frontend/tsconfig.json` | scheduling-calendar.tsx, schedule-post-form.tsx, failed-posts-panel.tsx | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Note: Plan 05 Task 2 is a `checkpoint:human-verify` task — visual verification only, no automated test.

---

## Wave 0 Requirements

- [ ] `extensions/scheduling-publishing/src/__tests__/post-state-machine.spec.ts` — stubs for R9.1, state machine transitions including STALE
- [ ] `extensions/scheduling-publishing/src/__tests__/schedule-resolver.service.spec.ts` — stubs for R9.2, R9.5
- [ ] `extensions/scheduling-publishing/src/__tests__/scheduler-tick.job.spec.ts` — stubs for R9.4
- [ ] `extensions/scheduling-publishing/src/__tests__/instagram.adapter.spec.ts` — stubs for R10.2, R10.3
- [ ] `extensions/scheduling-publishing/src/__tests__/facebook.adapter.spec.ts` — stubs for R10.2, R10.3
- [ ] `extensions/scheduling-publishing/src/__tests__/linkedin.adapter.spec.ts` — stubs for R10.2, R10.5
- [ ] `extensions/scheduling-publishing/src/__tests__/x.adapter.spec.ts` — stubs for R10.2, R10.5
- [ ] `extensions/scheduling-publishing/src/__tests__/publishing-worker.job.spec.ts` — stubs for R10.1, R10.4, R10.8
- [ ] `extensions/scheduling-publishing/src/__tests__/publish-attempt-logger.spec.ts` — stubs for R10.6

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calendar UI renders correctly | R9.3 | Visual layout verification | Open calendar, check day/week toggle, verify post cards display with platform icons |
| Platform publish end-to-end | R10.1 | Requires live API credentials | Schedule test post, verify appears on platform, check platformPostId stored |
| Failed post retry flow | R10.7-R10.8 | Requires simulated API failure | Mock adapter to fail, verify retry count, check failed dashboard shows post |
| STALE post visibility | R10.8 | Visual + workflow verification | Let publish window expire, verify STALE status in dashboard, retry reschedules |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
