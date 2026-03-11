---
phase: 3
slug: ai-service-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-10
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | extensions/ai-service/jest.config.ts |
| **Quick run command** | `npx jest --config extensions/ai-service/jest.config.ts --bail` |
| **Full suite command** | `npx jest --config extensions/ai-service/jest.config.ts` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx jest --config extensions/ai-service/jest.config.ts --bail`
- **After every plan wave:** Run `npx jest --config extensions/ai-service/jest.config.ts`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T1 | 01 | 1 | R4.1, R4.5, R4.7 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | W0 | pending |
| 01-T2 | 01 | 1 | R4.1, R4.5 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | W0 | pending |
| 02-T1 | 02 | 2 | R4.2 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | W0 | pending |
| 02-T2 | 02 | 2 | R4.2 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | W0 | pending |
| 03-T1 | 03 | 2 | R4.4, R4.5, R4.6 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | W0 | pending |
| 03-T2 | 03 | 2 | R4.6 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | W0 | pending |
| 04-T1 | 04 | 3 | R4.3, R4.7, NF4.4 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | W0 | pending |
| 04-T2 | 04 | 3 | NF4.4 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | W0 | pending |
| 04-T3 | 04 | 3 | R4.4 | compile | `cd extensions/ai-service && npx tsc --noEmit` | W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `extensions/ai-service/jest.config.ts` — jest config for extension package
- [ ] `extensions/ai-service/src/__tests__/` — test directory structure
- [ ] `extensions/ai-service/src/__tests__/brand-voice-prompt.builder.spec.ts` — stubs for brand voice injection (Plan 01)
- [ ] `extensions/ai-service/src/__tests__/model-costs.spec.ts` — stubs for cost calculation (Plan 01)
- [ ] `extensions/ai-service/src/__tests__/openai.provider.spec.ts` — stubs for R4.2 OpenAI (Plan 02)
- [ ] `extensions/ai-service/src/__tests__/anthropic.provider.spec.ts` — stubs for R4.2 Anthropic (Plan 02)
- [ ] `extensions/ai-service/src/__tests__/ollama.provider.spec.ts` — stubs for R4.2 Ollama (Plan 02)
- [ ] `extensions/ai-service/src/__tests__/ai-config.service.spec.ts` — stubs for R4.4 config (Plan 03)
- [ ] `extensions/ai-service/src/__tests__/ai-cost-logger.spec.ts` — stubs for R4.5 cost logging (Plan 03)
- [ ] `extensions/ai-service/src/__tests__/budget-circuit-breaker.spec.ts` — stubs for R4.6 budget (Plan 03)
- [ ] `extensions/ai-service/src/__tests__/ai-provider.router.spec.ts` — stubs for R4.3 routing (Plan 04)
- [ ] `extensions/ai-service/src/__tests__/ai-service.module.spec.ts` — stubs for module compilation (Plan 04)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Ollama local connectivity | R4.4 | Requires running Ollama instance | Start Ollama, run test suite with OLLAMA_URL set |
| Real provider API calls | R4.2-R4.4 | Requires API keys and costs money | Integration test with real keys in CI/staging |

*All core logic has automated verification via mocked providers.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
