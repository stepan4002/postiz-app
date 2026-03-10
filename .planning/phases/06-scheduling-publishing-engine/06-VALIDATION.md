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
| 06-01-01 | 01 | 1 | R9.1 | unit | `pnpm test -- --testPathPattern=post-state-machine` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | R9.2 | unit | `pnpm test -- --testPathPattern=schedule-resolver` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | R10.1-R10.3 | unit | `pnpm test -- --testPathPattern=platform-adapter` | ❌ W0 | ⬜ pending |
| 06-02-02 | 02 | 1 | R10.4-R10.5 | unit | `pnpm test -- --testPathPattern=publishing-worker` | ❌ W0 | ⬜ pending |
| 06-02-03 | 02 | 1 | R10.6-R10.8 | unit | `pnpm test -- --testPathPattern=retry-error` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | R9.3-R9.5 | integration | `pnpm test -- --testPathPattern=calendar` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 2 | R10.7 | integration | `pnpm test -- --testPathPattern=failed-posts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/scheduling-publishing/__tests__/post-state-machine.spec.ts` — stubs for R9.1
- [ ] `extensions/scheduling-publishing/__tests__/schedule-resolver.spec.ts` — stubs for R9.2
- [ ] `extensions/scheduling-publishing/__tests__/platform-adapter.spec.ts` — stubs for R10.1-R10.3
- [ ] `extensions/scheduling-publishing/__tests__/publishing-worker.spec.ts` — stubs for R10.4-R10.5
- [ ] `extensions/scheduling-publishing/__tests__/retry-error.spec.ts` — stubs for R10.6-R10.8
- [ ] `extensions/scheduling-publishing/__tests__/fixtures.ts` — shared test fixtures

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Calendar UI renders correctly | R9.3 | Visual layout verification | Open calendar, check day/week toggle, verify post cards display with platform icons |
| Platform publish end-to-end | R10.1 | Requires live API credentials | Schedule test post, verify appears on platform, check platformPostId stored |
| Failed post retry flow | R10.7-R10.8 | Requires simulated API failure | Mock adapter to fail, verify retry count, check failed dashboard shows post |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
