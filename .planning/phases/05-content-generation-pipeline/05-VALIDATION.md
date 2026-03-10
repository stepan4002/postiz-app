---
phase: 5
slug: content-generation-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29 with ts-jest |
| **Config file** | `extensions/content-generation/jest.config.ts` (Wave 0 creates) |
| **Quick run command** | `cd extensions/content-generation && pnpm test -- --testPathPattern=<file>` |
| **Full suite command** | `cd extensions/content-generation && pnpm test` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd extensions/content-generation && pnpm test -- --testPathPattern=<task-specific-file>`
- **After every plan wave:** Run `cd extensions/content-generation && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 0 | R5.1 | unit | `pnpm test -- content-post.service.spec.ts` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 0 | R5.2 | unit | `pnpm test -- content-post.service.spec.ts` | ❌ W0 | ⬜ pending |
| 05-01-03 | 01 | 0 | R5.5 | unit | `pnpm test -- post-variant.repository.spec.ts` | ❌ W0 | ⬜ pending |
| 05-01-04 | 01 | 0 | R6.1-R6.2 | unit | `pnpm test -- confidence-gating.spec.ts` | ❌ W0 | ⬜ pending |
| 05-01-05 | 01 | 0 | R6.3-R6.5 | unit | `pnpm test -- review-queue.service.spec.ts` | ❌ W0 | ⬜ pending |
| 05-01-06 | 01 | 0 | R5.7 | unit | `pnpm test -- prompt-templates.spec.ts` | ❌ W0 | ⬜ pending |
| 05-02-01 | 02 | 1 | R5.1-R5.7 | unit | `pnpm test -- content-post.service.spec.ts` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 1 | R5.3 | unit | `pnpm test -- content-post.service.spec.ts` | ❌ W0 | ⬜ pending |
| 05-02-03 | 02 | 1 | R5.6 | unit | `pnpm test -- confidence-gating.spec.ts` | ❌ W0 | ⬜ pending |
| 05-03-01 | 03 | 2 | R6.3 | unit | `pnpm test -- review-queue.service.spec.ts` | ❌ W0 | ⬜ pending |
| 05-03-02 | 03 | 2 | R6.4 | unit | `pnpm test -- review-queue.service.spec.ts` | ❌ W0 | ⬜ pending |
| 05-03-03 | 03 | 2 | R6.5 | unit | `pnpm test -- review-queue.service.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/content-generation/jest.config.ts` — Jest config matching ai-service pattern
- [ ] `extensions/content-generation/tsconfig.json` — TypeScript config
- [ ] `extensions/content-generation/tsconfig.spec.json` — Test TypeScript config
- [ ] `extensions/content-generation/package.json` — @social/content-generation package
- [ ] `extensions/content-generation/src/__tests__/content-post.service.spec.ts` — core pipeline tests
- [ ] `extensions/content-generation/src/__tests__/post-variant.repository.spec.ts` — variant DB tests
- [ ] `extensions/content-generation/src/__tests__/confidence-gating.spec.ts` — gating logic tests
- [ ] `extensions/content-generation/src/__tests__/review-queue.service.spec.ts` — review action tests
- [ ] `extensions/content-generation/src/__tests__/prompt-templates.spec.ts` — content type coverage

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI vision analyzes real image correctly | R5.2 | Requires actual AI provider call with real image | Upload test image, verify vision output contains relevant description |
| Generated captions match brand voice | R5.3 | Subjective quality assessment | Generate with configured BrandVoice, manually compare tone/style |
| Platform captions feel native | R5.4 | Subjective platform-norm compliance | Generate for all 4 platforms, compare against platform conventions |
| Review Queue UX flow | R6.3-R6.4 | End-to-end UI interaction | Walk through approve/edit/reject/regenerate flows in browser |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
