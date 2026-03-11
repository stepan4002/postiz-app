# Phase 8: Production Hardening & Deployment - Research

**Researched:** 2026-03-11
**Domain:** Docker Compose production configuration, Traefik reverse proxy, NestJS structured logging, SSRF protection, AI prompt injection safeguards, PostgreSQL/MinIO backup
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Reverse proxy:** Traefik (Docker-native, auto-discovers services via labels)
- **TLS:** Cloudflare proxy handles TLS termination; Traefik serves HTTP behind Cloudflare's edge
- **Network:** Only port 443 (Traefik) exposed to host; all databases/services (PostgreSQL, Redis, MinIO, Temporal) on Docker internal network only
- **Dev tools excluded:** No pgAdmin, RedisInsight, Temporal UI in production compose
- **Health checks:** GET /health/live (process check), GET /health/ready (checks DB, Redis, MinIO — returns dependency status JSON)
- **Logging:** Structured JSON logging to stdout/stderr for all workers and backend
- **Backup:** Daily pg_dump at 3 AM UTC, 7-day retention; daily MinIO rsync at 3 AM UTC; shell script (backup.sh) on VPS host via crontab; `docker exec` for pg_dump
- **Smoke test:** Both automated shell script (smoke-test.sh) and manual checklist; uses existing seed data from Phase 1; includes SSRF and prompt injection assertions; manual checklist for OAuth/publish steps needing real tokens

### Claude's Discretion
- Structured logging format approach (NestJS Logger configuration vs wrapper)
- Smoke test scope boundaries (what's automated vs manual)
- Docker Compose production file structure (single file vs override pattern)
- SSRF protection implementation details
- AI prompt injection safeguard implementation
- Docker restart policy specifics

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NF1.2 | Docker Compose production config: internal services bound to Docker network only; only port 443 exposed | Traefik service-level network config, no ports: on internal services |
| NF1.3 | AI prompt injection prevention: user input in `user` message role, never concatenated into system prompt | Pattern already implemented in Phase 5; safeguard validation in smoke test |
| NF1.4 | SSRF protection on URL inputs (HTTPS only, block private IP ranges) | Node.js URL validation + RFC 1918 blocklist pattern |
| NF1.5 | No secrets in code; all via environment variables | .env.example completeness audit |
| NF1.6 | Single-user authentication (operator is sole user) | Existing Postiz auth; DISABLE_REGISTRATION=true in prod |
| NF2.3 | Docker restart policies on all services | `restart: unless-stopped` pattern |
| NF2.4 | Graceful degradation: if AI provider down, posts can still be manually created/published | Not a deployment concern — already implemented in AI service layer |
| NF5.1 | Docker Compose single-command deployment | docker compose up -d |
| NF5.2 | Environment variable configuration for all settings | .env.example audit + documentation |
| NF5.3 | Health check endpoints for all services | NestJS HealthController in backend |
| NF5.4 | Structured logging (JSON) for all background workers | NestJS Logger + JSON format config |
</phase_requirements>

---

## Summary

This phase transitions from a working development system to a hardened production deployment. All seven prior phases built the application; this phase makes it safe, observable, and operable in a VPS context. The work falls into five clear domains: (1) production Docker Compose with Traefik reverse proxy, (2) health check endpoints in NestJS, (3) structured JSON logging, (4) security hardening (SSRF + prompt injection validation), and (5) backup scripts and smoke test.

The project already has strong foundations: PostgreSQL and Redis health checks exist in docker-compose.yaml, all workers use NestJS Logger consistently, the AI layer already routes user input to the `user` role (NF1.3 already implemented in Phase 5), and restart policies are partially present. The primary work is assembly and configuration, not new feature development.

**Primary recommendation:** Use a single docker-compose.prod.yaml (not override pattern) for clarity — the solo operator never needs to merge two files mentally. Traefik with Cloudflare origin certificates is the simplest path to production TLS. SSRF protection is a single utility function called at controller input validation. JSON logging in NestJS requires only configuring the built-in logger or swapping to pino via nestjs-pino.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Traefik | v3.x | Reverse proxy + Docker service discovery | Docker-native label routing; no config files needed; healthcheck at /ping |
| @nestjs/terminus | ^10.x | NestJS health check module | Official NestJS module; HealthIndicator pattern matches /health/ready requirements |
| nestjs-pino | ^4.x | Structured JSON logging for NestJS | pino is the fastest Node.js JSON logger; nestjs-pino replaces NestJS Logger globally |
| pino-pretty | ^13.x | Dev-time log formatting | Dev only; not used in production |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/config | already installed | Env var access in health checks | Already in project |
| prisma client | already installed | DB connectivity check in /health/ready | Already in project |
| ioredis | already installed | Redis ping in /health/ready | Already in project |
| @aws-sdk/client-s3 | already installed | MinIO HeadBucket check in /health/ready | Already in project |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nestjs-pino | NestJS built-in Logger + JSON format | Built-in logger cannot emit pure JSON without a custom transport; pino is the standard |
| nestjs-pino | winston | winston is heavier and slower; pino preferred for high-throughput worker logs |
| single docker-compose.prod.yaml | compose + override | Override pattern is correct for large teams; solo operator benefits from single file clarity |

**Installation:**
```bash
pnpm add @nestjs/terminus nestjs-pino pino-http
pnpm add -D pino-pretty
```

---

## Architecture Patterns

### Recommended Project Structure for Phase 8
```
docker-compose.prod.yaml          # Production Compose (single file)
traefik/
├── traefik.yaml                  # Static Traefik config
└── dynamic/                      # Optional dynamic config (empty for label-based)
scripts/
├── backup.sh                     # pg_dump + MinIO rsync, runs via crontab
└── smoke-test.sh                 # End-to-end automated validation
extensions/
└── health/
    └── src/
        ├── health.module.ts
        ├── health.controller.ts  # GET /health/live and /health/ready
        └── indicators/
            ├── database.indicator.ts
            ├── redis.indicator.ts
            └── minio.indicator.ts
apps/backend/src/
└── app.module.ts                 # Import HealthModule, LoggerModule
```

### Pattern 1: Traefik with Cloudflare HTTP (no internal TLS)

**What:** Cloudflare terminates TLS at its edge; Traefik listens on port 80 internally (mapped from host 443 through Cloudflare). Services get routing rules via Docker labels.

**When to use:** Solo VPS behind Cloudflare proxy — simplest possible TLS setup. Cloudflare handles certificate renewal automatically.

**Traefik static config (traefik/traefik.yaml):**
```yaml
# Source: Traefik v3 official docs
api:
  insecure: false
  dashboard: false          # Disable in production

entryPoints:
  web:
    address: ":80"          # Traefik listens HTTP; Cloudflare delivers on 443

providers:
  docker:
    exposedByDefault: false  # Services must opt-in via labels
    network: internal         # Only route services on the internal network

log:
  level: WARN
  format: json

accessLog:
  format: json
```

**docker-compose.prod.yaml Traefik service:**
```yaml
traefik:
  image: traefik:v3.3
  restart: unless-stopped
  ports:
    - "80:80"               # Only exposed port (Cloudflare delivers HTTPS externally)
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - ./traefik/traefik.yaml:/etc/traefik/traefik.yaml:ro
  networks:
    - internal
```

**App service labels:**
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.app.rule=Host(`social.yourdomain.com`)"
  - "traefik.http.routers.app.entrypoints=web"
  - "traefik.http.services.app.loadbalancer.server.port=5000"
```

### Pattern 2: Internal-Only Network Configuration

**What:** All backend services (PostgreSQL, Redis, MinIO) attached only to the `internal` Docker network with no `ports:` mapping. Traefik is the sole container with a host port binding.

```yaml
# docker-compose.prod.yaml skeleton
networks:
  internal:
    driver: bridge

services:
  postiz-postgres:
    networks: [internal]
    # NO ports: section — internal only
    restart: unless-stopped

  postiz-redis:
    networks: [internal]
    # NO ports: section
    restart: unless-stopped

  postiz-minio:
    networks: [internal]
    # NO ports: section
    restart: unless-stopped
```

### Pattern 3: NestJS Health Checks with @nestjs/terminus

**What:** Two endpoints — /health/live (instant process check) and /health/ready (checks all dependencies).

```typescript
// Source: @nestjs/terminus official docs
// extensions/health/src/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: DatabaseHealthIndicator,
    private redis: RedisHealthIndicator,
    private minio: MinioHealthIndicator,
  ) {}

  @Get('live')
  liveness() {
    // Traefik calls this — just proves process is up
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.redis.isHealthy('redis'),
      () => this.minio.isHealthy('minio'),
    ]);
  }
}
```

**Custom DatabaseHealthIndicator:**
```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '@social/database';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private prisma: PrismaService) { super(); }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (e) {
      throw new HealthCheckError('DB check failed', this.getStatus(key, false, { error: e.message }));
    }
  }
}
```

### Pattern 4: nestjs-pino Structured JSON Logging

**What:** Replace NestJS Logger globally with pino, which emits JSON by default. Worker classes continue calling `this.logger = new Logger(ClassName)` — nestjs-pino intercepts automatically.

```typescript
// apps/backend/src/app.module.ts addition
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        // In production: pure JSON. In dev: pino-pretty via transport
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty' }
          : undefined,
      },
    }),
    // ... rest of imports
  ],
})
export class AppModule {}
```

**In main.ts:**
```typescript
import { Logger } from 'nestjs-pino';
app.useLogger(app.get(Logger));
```

### Pattern 5: SSRF Protection Utility

**What:** Pure function that validates URLs before any outbound HTTP call from user-supplied input. Blocks private IP ranges per RFC 1918 and RFC 4193.

```typescript
// extensions/security/src/ssrf.guard.ts
import { URL } from 'url';
import * as net from 'net';

const PRIVATE_RANGES = [
  /^127\./,          // loopback
  /^10\./,           // RFC 1918
  /^172\.(1[6-9]|2\d|3[01])\./,  // RFC 1918
  /^192\.168\./,     // RFC 1918
  /^169\.254\./,     // link-local
  /^::1$/,           // IPv6 loopback
  /^fc00:/,          // IPv6 ULA
  /^fd[0-9a-f]{2}:/i, // IPv6 ULA
];

export function assertSafeUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs allowed');
  }
  const hostname = parsed.hostname;
  // Reject IP literals that are private
  if (net.isIP(hostname)) {
    for (const range of PRIVATE_RANGES) {
      if (range.test(hostname)) {
        throw new Error('Private IP ranges are not allowed');
      }
    }
  }
  // Reject known internal hostnames
  if (['localhost', 'metadata.google.internal'].includes(hostname)) {
    throw new Error('Internal hostnames are not allowed');
  }
}
```

**Usage:** Call `assertSafeUrl(url)` in any controller or service that accepts a URL from user input before making an outbound HTTP call.

### Pattern 6: Backup Script (backup.sh)

```bash
#!/usr/bin/env bash
# backup.sh — Run via crontab: 0 3 * * * /opt/social/scripts/backup.sh

set -euo pipefail

BACKUP_DIR="/opt/backups/social"
DATE=$(date +%Y%m%d)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR/postgres" "$BACKUP_DIR/minio"

# PostgreSQL backup via pg_dump in running container
docker exec postiz-postgres pg_dump \
  -U postiz-user \
  -d postiz-db-local \
  | gzip > "$BACKUP_DIR/postgres/postiz-$DATE.sql.gz"

# MinIO data backup (rsync local volume to backup dir)
# Adjust path to match Docker volume mount on VPS
rsync -a /var/lib/docker/volumes/social_postgres-volume/_data/ \
  "$BACKUP_DIR/minio/minio-$DATE/" 2>/dev/null || true

# Delete backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/minio" -maxdepth 1 -type d -mtime +$RETENTION_DAYS \
  -exec rm -rf {} + 2>/dev/null || true

echo "Backup complete: $DATE"
```

### Pattern 7: Smoke Test Script (smoke-test.sh)

```bash
#!/usr/bin/env bash
# smoke-test.sh — Automated assertions (manual steps in SMOKE-TEST-MANUAL.md)

set -euo pipefail

BASE_URL="${1:-https://social.yourdomain.com}"
API="$BASE_URL/api"
PASS=0; FAIL=0

assert_http() {
  local desc="$1" url="$2" expected="$3"
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [[ "$actual" == "$expected" ]]; then
    echo "PASS: $desc"
    ((PASS++))
  else
    echo "FAIL: $desc — expected $expected got $actual"
    ((FAIL++))
  fi
}

assert_json_contains() {
  local desc="$1" url="$2" key="$3" expected="$4"
  local val
  val=$(curl -s "$url" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$key',''))" 2>/dev/null)
  if [[ "$val" == "$expected" ]]; then
    echo "PASS: $desc"
    ((PASS++))
  else
    echo "FAIL: $desc — $key='$val' expected '$expected'"
    ((FAIL++))
  fi
}

echo "=== Health Checks ==="
assert_http "/health/live returns 200"   "$API/health/live"  "200"
assert_http "/health/ready returns 200"  "$API/health/ready" "200"
assert_json_contains "/health/ready status=ok" "$API/health/ready" "status" "ok"

echo ""
echo "=== Security Assertions ==="
# SSRF check: POST to any URL-accepting endpoint with a private IP
SSRF_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$API/companies/test-company/generate" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl":"http://192.168.1.1/evil"}' 2>/dev/null || echo "000")
if [[ "$SSRF_RESPONSE" == "4"* ]]; then
  echo "PASS: SSRF attempt blocked (HTTP $SSRF_RESPONSE)"
  ((PASS++))
else
  echo "FAIL: SSRF not blocked (HTTP $SSRF_RESPONSE)"
  ((FAIL++))
fi

echo ""
echo "=== Summary ==="
echo "PASSED: $PASS  FAILED: $FAIL"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
```

### Anti-Patterns to Avoid
- **Exposing database ports in production:** Never add `ports:` to PostgreSQL, Redis, or MinIO in docker-compose.prod.yaml — they must only be on the internal network
- **Traefik dashboard exposed publicly:** Set `api.insecure: false` and `dashboard: false` in traefik.yaml
- **Using `restart: always` instead of `unless-stopped`:** `unless-stopped` allows intentional stops (e.g., during maintenance); `always` restarts even after manual `docker stop`
- **DNS-based SSRF bypass:** URL validation must resolve hostnames before checking IP — a hostname like `internal.attacker.com` pointing to 10.0.0.1 bypasses hostname-only checks. For MVP, block known hostnames + IP literals (acceptable for solo operator context)
- **Blocking pg_dump with the app running:** pg_dump uses MVCC — it is safe to run against a live PostgreSQL container

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Health check response format | Custom health endpoint format | @nestjs/terminus | Standard format, Traefik/uptime monitors understand it |
| JSON logging | Custom JSON formatter on top of NestJS Logger | nestjs-pino | pino handles serialization, log levels, request context automatically |
| Private IP SSRF detection | Complex subnet math | The regex pattern above (RFC 1918 ranges) | Covers all cases for MVP; DNS-rebinding is out of scope |
| TLS certificate management | Manual certbot/acme | Cloudflare proxy (already decided) | Zero config, auto-renewal, DDoS protection included |

---

## Common Pitfalls

### Pitfall 1: Traefik `exposedByDefault: false` + Missing Labels
**What goes wrong:** Services not reachable after adding Traefik, despite correct network config.
**Why it happens:** With `exposedByDefault: false`, every service needs `traefik.enable=true` label.
**How to avoid:** Set the label on every service that Traefik should route. Services without labels are invisible to Traefik.
**Warning signs:** Traefik dashboard (if enabled temporarily in dev) shows 0 routers.

### Pitfall 2: Docker Socket Permissions
**What goes wrong:** Traefik container cannot read Docker events.
**Why it happens:** `/var/run/docker.sock` mounted without `:ro` or container user lacks access.
**How to avoid:** Mount as `:ro` (read-only). Traefik only needs to read labels, not write to Docker.

### Pitfall 3: NestJS Logger vs nestjs-pino Registration Order
**What goes wrong:** Some log lines are plain text, others are JSON.
**Why it happens:** `app.useLogger(app.get(Logger))` called after some modules have already logged.
**How to avoid:** Call `app.useLogger` as the very first line after `NestFactory.create()`, before any other setup.

### Pitfall 4: pg_dump Container Name Drift
**What goes wrong:** backup.sh fails because container was renamed or recreated with a different name.
**Why it happens:** `container_name:` not set in compose, so Docker generates a name.
**How to avoid:** Always set explicit `container_name: postiz-postgres` in docker-compose.prod.yaml. The backup script references this name.

### Pitfall 5: MinIO Volume Path on VPS
**What goes wrong:** rsync in backup.sh silently backs up empty directory.
**Why it happens:** Docker volume path `/var/lib/docker/volumes/...` varies by Docker root dir configuration.
**How to avoid:** Run `docker volume inspect <volume_name>` to get the actual Mountpoint on the VPS before finalizing backup.sh. Document the real path in .env or a comment.

### Pitfall 6: Cloudflare "Full" vs "Full (strict)" SSL Mode
**What goes wrong:** Browser gets TLS error or Cloudflare shows "526 Invalid SSL Certificate".
**Why it happens:** "Full (strict)" requires a valid cert on origin; Traefik serving plain HTTP behind Cloudflare is fine with "Full" mode only.
**How to avoid:** Set Cloudflare SSL mode to "Full" (not "Full (strict)") when Traefik serves HTTP without a cert. Or use a Cloudflare Origin Certificate on Traefik for "Full (strict)".

### Pitfall 7: DISABLE_REGISTRATION Not Set in Production
**What goes wrong:** Any visitor can create an account on the production Postiz instance.
**Why it happens:** Default in docker-compose.yaml is `DISABLE_REGISTRATION: 'false'`.
**How to avoid:** Set `DISABLE_REGISTRATION: 'true'` in docker-compose.prod.yaml for the single-operator use case (NF1.6).

---

## Code Examples

### NestJS terminus custom Redis health indicator
```typescript
// Source: @nestjs/terminus docs + ioredis pattern
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redis: Redis;

  constructor() {
    super();
    this.redis = new Redis(process.env.REDIS_URL!);
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redis.ping();
      return this.getStatus(key, pong === 'PONG');
    } catch (e) {
      throw new HealthCheckError('Redis check failed', this.getStatus(key, false, { error: e.message }));
    }
  }
}
```

### /health/ready expected response shape
```json
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "minio": { "status": "up" }
  },
  "error": {},
  "details": {
    "database": { "status": "up" },
    "redis": { "status": "up" },
    "minio": { "status": "up" }
  }
}
```

### docker-compose.prod.yaml restart policy
```yaml
# Use unless-stopped on all services
# Allows intentional docker stop during maintenance without auto-restart
restart: unless-stopped
```

### .env.example additions for Phase 8
```bash
# === Production Settings
DISABLE_REGISTRATION=true
NODE_ENV=production
LOG_LEVEL=info

# === Traefik / Domain
DOMAIN=social.yourdomain.com
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| nginx as reverse proxy | Traefik v3 for Docker | ~2020 | Label-based routing eliminates config files |
| winston for Node.js JSON logging | pino / nestjs-pino | ~2021 | 5-10x faster serialization, simpler API |
| manual TLS cert renewal | Cloudflare proxy or Let's Encrypt ACME | Ongoing | Zero-touch cert management |
| `restart: always` | `restart: unless-stopped` | Docker Compose v2 | Allows intentional stops |

**Deprecated/outdated:**
- Traefik v1 style `traefik.frontend.*` labels: Replaced by `traefik.http.routers.*` in v2/v3
- docker-compose.yml file (v1): Use `docker compose` (plugin) not `docker-compose` (standalone binary)

---

## Open Questions

1. **MinIO volume backup path**
   - What we know: Docker volumes are stored under Docker root dir (default `/var/lib/docker/volumes/`)
   - What's unclear: VPS may have Docker configured with a non-default root dir
   - Recommendation: Add a `verify_backup_paths` step in Wave 0 that runs `docker volume inspect` and hard-codes the real path in backup.sh

2. **Traefik port 80 vs 443 (Cloudflare origin)**
   - What we know: Cloudflare accepts HTTP on origin with "Full" SSL mode
   - What's unclear: VPS firewall rules — does the VPS already block port 443 externally?
   - Recommendation: Document in .env.example that the VPS firewall should only allow inbound 80 from Cloudflare IP ranges; the planner should add a firewall setup note to the deployment checklist

3. **nestjs-pino in extension packages vs apps/backend only**
   - What we know: Workers are in extension packages, not apps/backend
   - What's unclear: Do extension package workers use NestJS DI (and thus get pino automatically) or run as standalone processes?
   - Recommendation: If workers run via NestJS DI in apps/orchestrator, register LoggerModule there too. If standalone, configure pino directly in the worker entry point.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest (existing, configured at monorepo root) |
| Config file | jest.config.js (root) |
| Quick run command | `pnpm test --filter @social/health` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NF5.3 | /health/live returns 200 with { status: 'ok' } | unit | `pnpm test --filter @social/health -- health.controller.spec.ts` | ❌ Wave 0 |
| NF5.3 | /health/ready checks DB, Redis, MinIO and returns composite status | unit | `pnpm test --filter @social/health -- health.controller.spec.ts` | ❌ Wave 0 |
| NF1.4 | assertSafeUrl blocks private IP ranges (10.x, 192.168.x, 127.x) | unit | `pnpm test --filter @social/security -- ssrf.guard.spec.ts` | ❌ Wave 0 |
| NF1.4 | assertSafeUrl blocks non-HTTPS URLs | unit | `pnpm test --filter @social/security -- ssrf.guard.spec.ts` | ❌ Wave 0 |
| NF1.4 | assertSafeUrl allows valid HTTPS URLs | unit | `pnpm test --filter @social/security -- ssrf.guard.spec.ts` | ❌ Wave 0 |
| NF1.3 | smoke-test.sh prompt injection attempt returns 4xx | smoke | `bash scripts/smoke-test.sh` | ❌ Wave 0 |
| NF5.3 | smoke-test.sh /health/live + /health/ready assertions pass | smoke | `bash scripts/smoke-test.sh` | ❌ Wave 0 |
| NF2.3 | All services in docker-compose.prod.yaml have restart: unless-stopped | manual | Docker Compose file review | ❌ Wave 0 |
| NF1.2 | No database ports exposed in docker-compose.prod.yaml | manual | Docker Compose file review | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test --filter @social/health && pnpm test --filter @social/security`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green + smoke-test.sh passes before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `extensions/health/src/health.controller.spec.ts` — covers NF5.3 (mock indicators)
- [ ] `extensions/health/src/indicators/database.indicator.spec.ts` — covers DB health indicator
- [ ] `extensions/security/src/ssrf.guard.spec.ts` — covers NF1.4 (pure unit, no network)
- [ ] `scripts/smoke-test.sh` — covers NF5.3, NF1.3, NF1.4 at integration level
- [ ] `scripts/backup.sh` — manual-only validation (requires running Docker + VPS)

---

## Sources

### Primary (HIGH confidence)
- Traefik v3 official docs (traefik.io/traefik) — Docker provider, label syntax, entryPoints
- @nestjs/terminus official docs (docs.nestjs.com/recipes/terminus) — HealthCheck, HealthIndicator pattern
- nestjs-pino GitHub (github.com/iamolegga/nestjs-pino) — LoggerModule.forRoot, app.useLogger pattern
- Docker Compose restart policy docs (docs.docker.com) — unless-stopped behavior
- RFC 1918 (tools.ietf.org/html/rfc1918) — private IP ranges for SSRF guard

### Secondary (MEDIUM confidence)
- Cloudflare SSL modes documentation — "Full" vs "Full (strict)" for HTTP origins
- pg_dump with docker exec pattern — widely documented in PostgreSQL + Docker operational guides

### Tertiary (LOW confidence)
- VPS firewall + Cloudflare IP allowlisting — configuration varies by VPS provider

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — @nestjs/terminus and nestjs-pino are the canonical choices; Traefik v3 is current
- Architecture: HIGH — Docker Compose internal network isolation is straightforward; patterns verified against official Traefik v3 docs
- Pitfalls: HIGH — Traefik label requirements and NestJS logger ordering are well-documented gotchas
- Backup scripts: MEDIUM — Pattern is correct; actual volume paths require VPS-side verification

**Research date:** 2026-03-11
**Valid until:** 2026-06-11 (stable tooling, 90-day validity)
