---
phase: 1
slug: fork-and-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x (Postiz existing) + custom isolation tests |
| **Config file** | `jest.config.ts` (root) or per-package configs |
| **Quick run command** | `npx nx run-many --target=test --projects=extensions/*` |
| **Full suite command** | `npx nx run-many --target=test --all` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx nx run-many --target=test --projects=extensions/*`
- **After every plan wave:** Run `npx nx run-many --target=test --all`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | R1.1 | setup | `docker compose -f docker/docker-compose.dev.yaml up -d` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | R1.2-R1.3 | unit | `npx nx test extensions/multi-company` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | R2.1-R2.8 | unit | `npx nx test extensions/multi-company -- --testPathPattern=schema` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | R1.4-R1.5 | integration | `npx nx test extensions/multi-company -- --testPathPattern=isolation` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/multi-company/src/__tests__/` — test directory structure
- [ ] `extensions/multi-company/jest.config.ts` — Jest config for extension package
- [ ] `docker/docker-compose.dev.yaml` — dev environment setup
- [ ] Verify existing Postiz test infrastructure works after fork

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Company switcher UX | R1.4 | Visual/interaction check | Switch between companies in header dropdown, verify page context updates |
| Docker dev environment starts | R1.1 | Infrastructure check | Run `docker compose up`, verify all services healthy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
