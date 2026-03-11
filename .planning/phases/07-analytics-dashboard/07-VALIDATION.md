---
phase: 7
slug: analytics-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x with ts-jest |
| **Config file** | `extensions/analytics-dashboard/jest.config.ts` (Wave 0 creates) |
| **Quick run command** | `pnpm --filter @social/analytics-dashboard test` |
| **Full suite command** | `pnpm --filter @social/analytics-dashboard test --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @social/analytics-dashboard test`
- **After every plan wave:** Run `pnpm --filter @social/analytics-dashboard test --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | R11.1 | unit | `pnpm --filter @social/analytics-dashboard test -- --testPathPattern=analytics-ingestion` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | R11.2, R11.3 | unit | `pnpm --filter @social/analytics-dashboard test -- --testPathPattern=analytics.repository` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | R11.4 | unit | `pnpm --filter @social/analytics-dashboard test -- --testPathPattern=analytics.controller` | ❌ W0 | ⬜ pending |
| 07-01-04 | 01 | 1 | R11.5 | unit | Verified by module structure (no import of publishing module) | N/A | ⬜ pending |
| 07-02-01 | 02 | 1 | R12.1-R12.4 | unit | `pnpm --filter @social/analytics-dashboard test -- --testPathPattern=dashboard` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | R12.5 | unit | Mock prisma in DashboardService test | ❌ W0 | ⬜ pending |
| 07-02-03 | 02 | 1 | NF3.1 | manual | Monitor response time via logs | manual-only | ⬜ pending |
| 07-02-04 | 02 | 1 | NF3.2 | unit | Verify DashboardService makes 0 adapter calls | ❌ W0 | ⬜ pending |
| 07-02-05 | 02 | 1 | NF3.4 | smoke | `pnpm prisma validate` after migration | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/analytics-dashboard/` — package scaffolding (package.json, tsconfig.json, jest.config.ts, src/index.ts)
- [ ] `extensions/analytics-dashboard/src/__tests__/analytics-ingestion.job.spec.ts` — stubs for R11.1
- [ ] `extensions/analytics-dashboard/src/__tests__/analytics.repository.spec.ts` — stubs for R11.2, R11.3
- [ ] `extensions/analytics-dashboard/src/__tests__/dashboard.service.spec.ts` — stubs for R12.1-R12.5
- [ ] `extensions/analytics-dashboard/src/__tests__/instagram.analytics.adapter.spec.ts` — stubs for adapter pattern
- [ ] Prisma migration for PostMetrics and DashboardCache models

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard response time < 2s | NF3.1 | Requires realistic data volume and browser profiling | Load dashboard with 50+ posts, verify page load < 2s via DevTools |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
