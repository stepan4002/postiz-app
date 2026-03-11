---
phase: 8
slug: production-hardening-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-11
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (existing, configured at monorepo root) |
| **Config file** | jest.config.js (root) |
| **Quick run command** | `pnpm test --filter @social/health && pnpm test --filter @social/security` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --filter @social/health && pnpm test --filter @social/security`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green + smoke-test.sh passes
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | NF5.3 | unit | `pnpm test --filter @social/health -- health.controller.spec.ts` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | NF5.3 | unit | `pnpm test --filter @social/health -- health.controller.spec.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | NF1.4 | unit | `pnpm test --filter @social/security -- ssrf.guard.spec.ts` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | NF1.4 | unit | `pnpm test --filter @social/security -- ssrf.guard.spec.ts` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | NF1.2 | manual | Docker Compose file review | N/A | ⬜ pending |
| 08-03-02 | 03 | 2 | NF2.3 | manual | Docker Compose file review | N/A | ⬜ pending |
| 08-04-01 | 04 | 3 | NF5.3,NF1.3 | smoke | `bash scripts/smoke-test.sh` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/health/src/__tests__/health.controller.spec.ts` — stubs for NF5.3
- [ ] `extensions/security/src/__tests__/ssrf.guard.spec.ts` — stubs for NF1.4
- [ ] `scripts/smoke-test.sh` — stub script for NF5.3, NF1.3, NF1.4

*Existing Jest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No DB ports exposed in prod compose | NF1.2 | Compose file structure review | Verify no `ports:` on postgres/redis/minio services |
| All services have restart policy | NF2.3 | Compose file structure review | Verify `restart: unless-stopped` on all services |
| Backup script runs correctly | NF5.2 | Requires running Docker + VPS | Run `bash scripts/backup.sh` on VPS, verify dump file created |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
