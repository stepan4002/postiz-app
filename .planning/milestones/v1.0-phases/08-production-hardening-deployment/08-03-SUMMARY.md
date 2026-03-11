---
phase: 08-production-hardening-deployment
plan: 03
subsystem: infra
tags: [docker, traefik, nginx, compose, backup, postgresql, minio, cloudflare]

# Dependency graph
requires:
  - phase: 08-01
    provides: Health check endpoints and structured JSON logging used by Traefik routing

provides:
  - Production Docker Compose with Traefik reverse proxy and internal-only networking
  - traefik/traefik.yaml static configuration (exposedByDefault=false, JSON logging)
  - scripts/backup.sh for daily pg_dump + MinIO rsync with 7-day retention

affects:
  - 08-04 (smoke test plan needs docker-compose.prod.yaml to test against)

# Tech tracking
tech-stack:
  added:
    - traefik:v3.3 (reverse proxy with Docker label-based routing)
  patterns:
    - Single docker-compose.prod.yaml (not override pattern) for solo operator clarity
    - Internal-only Docker bridge network — all services except Traefik have no ports mapping
    - Cloudflare TLS termination on 443 → HTTP origin on 80 (Cloudflare "Full" SSL mode)
    - restart: unless-stopped on all services (allows intentional maintenance stops)

key-files:
  created:
    - docker-compose.prod.yaml
    - traefik/traefik.yaml
    - scripts/backup.sh
  modified: []

key-decisions:
  - "Traefik port 80 exposed (not 443): Cloudflare terminates TLS at edge on 443 and forwards to origin:80; direct port 80 access blocked via ufw Cloudflare IP allowlist"
  - "NF2.4 graceful AI degradation is a code-level concern handled in Phase 3 AIProviderRouter, not a deployment config concern; documented here for traceability"
  - "MinIO volume path in backup.sh uses default Docker path with operator note to verify via docker volume inspect on VPS"
  - "MINIO_VOLUME_PATH env var overridable in backup.sh for non-default Docker root configurations"

patterns-established:
  - "Pattern: All backend services (PostgreSQL, Redis, MinIO) have NO ports: mapping — accessible only on internal Docker network"
  - "Pattern: Traefik is sole container with host port binding (port 80)"
  - "Pattern: traefik.enable=true label required on any service Traefik should route (exposedByDefault: false)"
  - "Pattern: backup.sh env vars (BACKUP_DIR, RETENTION_DAYS, MINIO_VOLUME_PATH) allow configuration without script edits"

requirements-completed: [NF1.2, NF2.3, NF2.4, NF5.1]

# Metrics
duration: 2min
completed: 2026-03-11
---

# Phase 8 Plan 3: Production Docker Compose and Backup Infrastructure Summary

**Traefik v3.3 reverse proxy on internal Docker bridge network with pg_dump + MinIO rsync backup script and 7-day retention**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-11T02:18:41Z
- **Completed:** 2026-03-11T02:19:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Production Docker Compose with 5 services all using `restart: unless-stopped`; only port 80 exposed via Traefik (Cloudflare terminates TLS on 443); PostgreSQL, Redis, MinIO have no host port mappings
- Traefik v3.3 static config with `exposedByDefault: false`, JSON access logging, dashboard disabled in production
- Backup script with configurable BACKUP_DIR, pg_dump via docker exec, MinIO rsync, 7-day cleanup, and crontab setup instructions

## Task Commits

Each task was committed atomically:

1. **Task 1: Production Docker Compose with Traefik and internal networking** - `10abd1ee` (feat)
2. **Task 2: Backup script with pg_dump and MinIO rsync** - `3c0a24ca` (feat)

## Files Created/Modified
- `docker-compose.prod.yaml` - Production Docker Compose: 5 services (traefik, postiz, postiz-postgres, postiz-redis, postiz-minio), internal network, Traefik labels on postiz service, DISABLE_REGISTRATION=true
- `traefik/traefik.yaml` - Traefik static config: api.insecure=false, dashboard=false, exposedByDefault=false, network=internal, JSON logging
- `scripts/backup.sh` - Backup script: pg_dump + gzip, MinIO rsync, 7-day retention, crontab setup comment, operator verification guidance

## Decisions Made

- **Port 80 vs 443 for Traefik:** Cloudflare terminates TLS at its edge on port 443 and forwards to the origin server on port 80. The VPS itself exposes only port 80. Direct public access to port 80 is blocked by ufw (allow from Cloudflare IPs only). This fully honors the network isolation intent (no direct database/service access). Inline comment in docker-compose.prod.yaml documents this architecture and sets Cloudflare SSL mode to "Full".
- **NF2.4 graceful AI degradation:** Already implemented in Phase 3 via AIProviderRouter fallback logic. Not a deployment config concern — documented here for requirements traceability. The 08-04 smoke test includes a testable assertion.
- **MinIO backup path:** Default Docker volume path used with operator note to verify via `docker volume inspect postiz_minio-data`. MINIO_VOLUME_PATH env var allows override without script edits.
- **No Temporal in production compose:** Postiz upstream image handles scheduling internally; Temporal stack (temporal-elasticsearch, temporal-postgresql, temporal, temporal-admin-tools, temporal-ui) excluded from production per user decision and NF1.6 (dev tools excluded from prod).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

Before running `docker compose -f docker-compose.prod.yaml up -d`:

1. Create a `.env` file (or export env vars) with at minimum:
   ```bash
   DOMAIN=social.yourdomain.com
   JWT_SECRET=<random string>
   ENCRYPTION_KEY=<64-char hex key>
   POSTGRES_PASSWORD=<secure password>
   MINIO_ROOT_PASSWORD=<secure password>
   ```
2. Configure Cloudflare DNS: A record pointing domain to VPS IP, proxy enabled (orange cloud), SSL mode = "Full"
3. Configure VPS firewall: `ufw allow from Cloudflare IPs to any port 80` — see Cloudflare IP ranges at https://www.cloudflare.com/ips/
4. Verify MinIO backup path before first backup run: `docker volume inspect postiz_minio-data` and update `MINIO_VOLUME_PATH` if needed
5. Add crontab for backup: `0 3 * * * /opt/social/scripts/backup.sh >> /var/log/social-backup.log 2>&1`

## Next Phase Readiness

- Production infrastructure ready for smoke test (08-04)
- docker-compose.prod.yaml provides the deployment target for smoke-test.sh assertions
- All NF5.1 (single command deployment) and NF1.2 (internal-only service networking) requirements met

---
*Phase: 08-production-hardening-deployment*
*Completed: 2026-03-11*

## Self-Check: PASSED

- FOUND: docker-compose.prod.yaml
- FOUND: traefik/traefik.yaml
- FOUND: scripts/backup.sh
- FOUND: .planning/phases/08-production-hardening-deployment/08-03-SUMMARY.md
- FOUND commit: 10abd1ee (Task 1)
- FOUND commit: 3c0a24ca (Task 2)
