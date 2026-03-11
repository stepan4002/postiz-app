# Phase 8: Production Hardening & Deployment - Context

**Gathered:** 2026-03-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the system secure, observable, and deployable to a production VPS. Covers Docker Compose production config, reverse proxy with TLS, health checks, structured logging, security hardening (SSRF, prompt injection), backup strategy, environment documentation, and end-to-end smoke test. No new features — this is operational readiness.

</domain>

<decisions>
## Implementation Decisions

### Reverse proxy & TLS
- Traefik as reverse proxy (Docker-native, auto-discovers services via labels)
- Single domain setup (e.g., social.yourdomain.com — everything behind one hostname)
- Cloudflare proxy handles TLS termination; Traefik serves HTTP behind Cloudflare's edge
- Internal-only network: only port 443 (Traefik) exposed to host; all databases/services (PostgreSQL, Redis, MinIO, Temporal) communicate via Docker internal network only
- No dev tools (pgAdmin, RedisInsight, Temporal UI) exposed in production compose

### Logging & observability
- Deep health check endpoints: GET /health/live (simple process check for Traefik), GET /health/ready (checks DB, Redis, MinIO connectivity and returns dependency status JSON)
- No uptime monitoring/alerting in this phase — deferred to future milestone
- Structured JSON logging to stdout/stderr for all workers and backend

### Backup strategy
- Daily PostgreSQL backup via pg_dump at 3 AM UTC, 7-day retention (auto-delete older backups)
- Daily MinIO data rsync to backup directory at 3 AM UTC
- Shell script (backup.sh) on VPS host, triggered by host crontab
- Uses `docker exec` for pg_dump against the running PostgreSQL container

### Smoke test
- Both automated shell script (smoke-test.sh) and manual checklist for steps requiring real API tokens
- Automated script curls health endpoints, creates test data via API, verifies responses
- Uses existing seed data from Phase 1 (no fresh test company creation)
- Includes security assertions: attempt SSRF URL and prompt injection, verify they're blocked
- Manual checklist covers OAuth connect, actual publish, metrics verification (requires real tokens)

### Claude's Discretion
- Structured logging format approach (NestJS Logger configuration vs wrapper)
- Smoke test scope boundaries (what's automated vs manual)
- Docker Compose production file structure (single file vs override pattern)
- SSRF protection implementation details
- AI prompt injection safeguard implementation
- Docker restart policy specifics

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key constraint: solo-operator VPS, keep the stack simple, no extra monitoring containers.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `var/docker/nginx.conf`: Upstream Postiz nginx config — may not be needed with Traefik, but useful reference
- `Dockerfile.dev`: Uses node:22, nginx, pm2 — production Dockerfile can be based on this
- `docker-compose.yaml`: Existing production-like compose with PostgreSQL/Redis health checks already defined
- `docker-compose.dev.yaml`: Dev compose with pgAdmin, RedisInsight, Temporal stack — reference for what to exclude in prod
- `.env.example`: Already documents most env vars including extension-specific ones (ENCRYPTION_KEY, MINIO_*, AI_*)

### Established Patterns
- NestJS `Logger` class used consistently across all extension workers (TokenRefreshJob, MediaProcessingJob, PublishingWorkerJob, SchedulerTickJob, AnalyticsIngestionJob, DashboardSummaryJob)
- Docker health checks already exist for PostgreSQL (`pg_isready`) and Redis (`redis-cli ping`) in docker-compose.yaml
- Per-job error isolation pattern in all cron jobs (try/catch per item, never blocks batch)
- Extension zone pattern: all custom code in `extensions/` pnpm workspace

### Integration Points
- Health check endpoint: new controller in backend (apps/backend) or extension
- Traefik labels: added to service definitions in docker-compose.prod.yaml
- Backup script: standalone shell script, not part of the application code
- Smoke test: standalone script that calls the API externally

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-production-hardening-deployment*
*Context gathered: 2026-03-11*
