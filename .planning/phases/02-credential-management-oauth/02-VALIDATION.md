---
phase: 2
slug: credential-management-oauth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest + ts-jest (same config as multi-company extension) |
| **Config file** | `extensions/credential-management/jest.config.ts` — Wave 0 |
| **Quick run command** | `pnpm --filter @social/credential-management test` |
| **Full suite command** | `pnpm --filter @social/credential-management test --coverage` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @social/credential-management test`
- **After every plan wave:** Run `pnpm --filter @social/credential-management test --coverage`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | R3.2 | unit | `pnpm --filter @social/credential-management test` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | NF1.1 | unit | `pnpm --filter @social/credential-management test` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | R3.3 | unit | `pnpm --filter @social/credential-management test` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | R3.3, R3.5 | unit | `pnpm --filter @social/credential-management test` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | R3.4 | unit | `pnpm --filter @social/credential-management test` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | R3.1 | unit | `pnpm --filter @social/credential-management test` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 2 | R3.6 | integration | `pnpm --filter @social/credential-management test:integration` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/credential-management/` — package does not exist yet, needs creation
- [ ] `extensions/credential-management/package.json` — workspace package
- [ ] `extensions/credential-management/jest.config.ts` — copy pattern from multi-company
- [ ] `extensions/credential-management/tsconfig.json` + `tsconfig.spec.json` — copy from multi-company
- [ ] `extensions/credential-management/src/__tests__/token.encryption.spec.ts` — covers R3.2, NF1.1
- [ ] `extensions/credential-management/src/__tests__/token.health.spec.ts` — covers R3.4
- [ ] `extensions/credential-management/src/__tests__/token.refresh.job.spec.ts` — covers R3.3, R3.5
- [ ] Prisma migration: `20260310000002_integration_token_health` — adds `lastRefreshedAt`, `consecutiveFailures`, `tokenEncrypted`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth connect flow end-to-end | R3.1 | Requires real Meta/LinkedIn/X API credentials and browser interaction | 1. Click "Connect Instagram" on brand page 2. Complete OAuth flow 3. Verify integration appears linked to brand |
| Token refresh actually works against live API | R3.3 | Requires real expired/near-expiry tokens | Wait for token to reach 75% lifetime, verify cron refreshes it |
| Dashboard health alerts visible | R3.5 | UI rendering verification | Navigate to dashboard, verify warning banner appears for unhealthy tokens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
