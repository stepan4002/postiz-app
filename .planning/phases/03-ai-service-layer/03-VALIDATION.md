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
| TBD | 01 | 1 | R4.1 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | ❌ W0 | ⬜ pending |
| TBD | 01 | 1 | R4.2 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 1 | R4.3 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | ❌ W0 | ⬜ pending |
| TBD | 02 | 1 | R4.4 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | ❌ W0 | ⬜ pending |
| TBD | 03 | 2 | R4.5 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | ❌ W0 | ⬜ pending |
| TBD | 03 | 2 | R4.6 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | ❌ W0 | ⬜ pending |
| TBD | 03 | 2 | R4.7 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | ❌ W0 | ⬜ pending |
| TBD | 03 | 2 | NF4.4 | unit | `npx jest --config extensions/ai-service/jest.config.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extensions/ai-service/jest.config.ts` — jest config for extension package
- [ ] `extensions/ai-service/src/__tests__/` — test directory structure
- [ ] `extensions/ai-service/src/__tests__/ai-service.interface.spec.ts` — stubs for R4.1
- [ ] `extensions/ai-service/src/__tests__/openai-provider.spec.ts` — stubs for R4.2
- [ ] `extensions/ai-service/src/__tests__/anthropic-provider.spec.ts` — stubs for R4.3
- [ ] `extensions/ai-service/src/__tests__/ollama-provider.spec.ts` — stubs for R4.4
- [ ] `extensions/ai-service/src/__tests__/provider-router.spec.ts` — stubs for R4.5
- [ ] `extensions/ai-service/src/__tests__/cost-tracking.spec.ts` — stubs for R4.6-R4.7
- [ ] `extensions/ai-service/src/__tests__/brand-voice.spec.ts` — stubs for brand voice injection

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
