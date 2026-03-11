# Milestones

## v1.0 MVP — Social Command Centre (Shipped: 2026-03-11)

**Phases completed:** 8 phases, 38 plans, 9 tasks

**Key accomplishments:**
- Postiz v2.20.1 forked with extension zone architecture (`extensions/` pnpm workspace) and multi-company data model (Company → Brand → BrandVoice → SocialAccount)
- OAuth credential management with AES-256-GCM encryption and proactive token refresh (75% lifetime) for Instagram, Facebook, LinkedIn, X
- Provider-agnostic AI service layer (OpenAI, Anthropic, Ollama) with per-company cost tracking, budget circuit breaker, and brand voice injection
- Per-company media library with MinIO S3 storage, Uppy multipart upload, sharp-based async variant processing
- AI content generation pipeline: image analysis → caption generation → platform adaptation → confidence gating → review queue
- Scheduling & publishing engine with post state machine, 4 platform adapters, exponential backoff retry, error classification
- Analytics ingestion at T+1h/T+24h/T+7d with pre-computed 4-widget personal dashboard (DashboardCache)
- Production hardening: health checks (@nestjs/terminus), SSRF protection, Traefik reverse proxy, backup scripts, automated smoke tests

**Requirements:** 94/94 satisfied (71 functional + 23 non-functional)
**Tech debt:** 6 non-blocking items (see audit report)
**Archive:** [ROADMAP](milestones/v1.0-ROADMAP.md) | [REQUIREMENTS](milestones/v1.0-REQUIREMENTS.md) | [AUDIT](milestones/v1.0-MILESTONE-AUDIT.md)

---

