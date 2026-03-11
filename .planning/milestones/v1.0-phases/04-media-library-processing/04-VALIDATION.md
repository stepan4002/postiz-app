---
phase: 4
slug: media-library-processing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 with ts-jest |
| **Config file** | `extensions/media-library/jest.config.ts` (new — Wave 0) |
| **Quick run command** | `cd extensions/media-library && pnpm test -- --passWithNoTests` |
| **Full suite command** | `pnpm test --filter @social/media-library` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd extensions/media-library && pnpm test -- --passWithNoTests`
- **After every plan wave:** Run `pnpm test --filter @social/media-library`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | R7.2 | unit | `pnpm test --testPathPattern="minio.storage.spec"` | Wave 0 | ⬜ pending |
| 04-01-02 | 01 | 1 | R7.1, R7.4 | unit | `pnpm test --testPathPattern="company-media.repository.spec"` | Wave 0 | ⬜ pending |
| 04-02-01 | 02 | 1 | R7.5 | unit | `pnpm test --testPathPattern="company-media.service.spec"` | Wave 0 | ⬜ pending |
| 04-02-02 | 02 | 1 | R7.3 | unit | `pnpm test --testPathPattern="media-processing.service.spec"` | Wave 0 | ⬜ pending |
| 04-03-01 | 03 | 2 | R8.1, R8.3 | unit | `pnpm test --testPathPattern="media-processing.service.spec"` | Wave 0 | ⬜ pending |
| 04-03-02 | 03 | 2 | NF2.2 | unit | `pnpm test --testPathPattern="media-processing.job.spec"` | Wave 0 | ⬜ pending |
| 04-04-01 | 04 | 2 | R8.4 | unit | `pnpm test --testPathPattern="platform-media-validator.spec"` | Wave 0 | ⬜ pending |
| 04-04-02 | 04 | 2 | R8.2, NF3.3 | manual | Manual: verify response time < 2s on upload | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/media-library/package.json` — new extension package
- [ ] `extensions/media-library/tsconfig.json` — extends ../../tsconfig.base.json
- [ ] `extensions/media-library/jest.config.ts` — mirrors ai-service/jest.config.ts
- [ ] `extensions/media-library/src/__tests__/minio.storage.spec.ts` — covers R7.2
- [ ] `extensions/media-library/src/__tests__/company-media.repository.spec.ts` — covers R7.1, R7.4
- [ ] `extensions/media-library/src/__tests__/company-media.service.spec.ts` — covers R7.5
- [ ] `extensions/media-library/src/__tests__/media-processing.service.spec.ts` — covers R7.3, R8.1, R8.3
- [ ] `extensions/media-library/src/__tests__/platform-media-validator.spec.ts` — covers R8.4
- [ ] `extensions/media-library/src/__tests__/media-processing.job.spec.ts` — covers NF2.2
- [ ] Add `@social/media-library` to `tsconfig.base.json` paths

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Upload returns before variant generation | R8.2, NF3.3 | Timing behavior requires real async flow | Upload image via API, verify response < 2s, verify variant created after response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
