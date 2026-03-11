# Phase 2: Credential Management & OAuth - Research

**Researched:** 2026-03-10
**Domain:** OAuth token lifecycle, AES-256-GCM encryption, NestJS @Cron background jobs, Prisma schema extension
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation details were deferred to Claude's discretion. No locked decisions from the user.

### Claude's Discretion

**Token Encryption:**
- Encryption approach: AES-256-CBC (reuse AuthService.fixedEncryption) vs AES-256-GCM (new implementation) — choose based on security vs complexity
- Token storage model: extend existing Integration model at service layer vs new PlatformCredential entity in extension zone — choose based on upstream compatibility
- Migration strategy: migrate all existing plaintext tokens vs encrypt only new tokens — choose based on what's practical
- Key management: reuse JWT_SECRET vs separate ENCRYPTION_KEY env var — choose based on security vs operational simplicity

**OAuth Flow Integration:**
- Integration approach: wrap upstream Postiz OAuth providers with company/brand context middleware vs fork providers into extension zone — minimize upstream divergence
- Connect UX: brand settings page flow (Company -> Brand -> Connect) vs global connect + assign to brand
- Meta parent-child tokens: store user token and derive page tokens vs one token per page directly — follow how Meta API actually works
- Account exclusivity: each social account exclusive to one brand vs shared across brands — choose based on data model clarity

**Token Refresh Strategy:**
- Job mechanism: BullMQ recurring job vs NestJS @Cron decorator vs Temporal workflow — choose based on existing infrastructure (BullMQ already in use, Temporal deferred to Phase 6)
- Refresh failure handling: alert operator with days remaining vs auto-disable and alert — choose right balance of safety vs convenience
- Failure threshold: 3 consecutive failures vs immediate alert — choose sensible threshold
- Configuration scope: system-wide vs per-company — choose what makes sense for solo operator

**Token Health & Alerts:**
- Health UI placement: dashboard banner + settings page vs inline on connected accounts only — choose right visibility level
- Health states: 3-state (Healthy/Warning/Expired) vs 4-state (add Refreshing) — choose right granularity
- Health data detail: summary only (lastRefreshedAt, expiresAt, consecutiveFailures) vs full attempt log — choose what's useful for solo operator
- Notification mechanism: dashboard UI only vs add email notifications — choose what's appropriate for Milestone 1

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| R3.1 | OAuth connect flow for Instagram (Meta Business API), Facebook (Meta Graph API), LinkedIn (Marketing API), X (API v2) | Upstream providers already implement full OAuth flows; wrapping with brand context avoids re-implementing them |
| R3.2 | PlatformCredential entity with encrypted token storage (AES-256) | NF1.1 mandates AES-256-GCM; new migration adds 3 fields to Integration; encrypt/decrypt at service layer |
| R3.3 | Proactive token refresh at 75% of token lifetime via background job | NestJS @Cron on RUN_CRON flag; no Temporal until Phase 6 |
| R3.4 | Token health dashboard: last refreshed, expires at, consecutive failures | 3 new fields on Integration; surfaced via existing /integrations/list endpoint + new health endpoint |
| R3.5 | Alert when token refresh fails (surface in operator dashboard) | Existing NotificationService.inAppNotification() already used by upstream for token errors |
| R3.6 | Meta parent-child token tracking (user token -> derived page tokens) | Facebook/Instagram providers already implement isBetweenSteps page selection; rootInternalId already tracks this |
| NF1.1 | All OAuth tokens encrypted at rest (AES-256-GCM) | Must be AES-256-GCM per requirements; AuthService.fixedEncryption uses AES-256-CBC — need new GCM implementation |
</phase_requirements>

---

## Summary

Phase 2 builds credential management on top of what Phase 1 established. The critical insight from reading the codebase is that upstream Postiz already handles all four OAuth provider flows completely — Meta (Instagram + Facebook with `isBetweenSteps` page selection), LinkedIn (with refresh token support), and X (OAuth 1.0a via twitter-api-v2). The work in this phase is not re-implementing OAuth; it is layering brand context onto the existing flows and adding token lifecycle management that currently does not exist.

The upstream Integration model stores tokens in plaintext. NF1.1 requires AES-256-GCM. The existing `AuthService.fixedEncryption()` uses AES-256-CBC with a fixed IV derived from JWT_SECRET — this is weaker (no per-ciphertext IV randomness) and cannot be used for NF1.1 compliance. A new GCM implementation using a separate `ENCRYPTION_KEY` env var with a random 12-byte IV prepended to the ciphertext is the correct approach. All new token writes encrypt; existing tokens are migrated in a single Prisma migration run at startup.

The existing token refresh infrastructure (Temporal `refreshTokenWorkflow`) is active in production Postiz but Temporal is deferred to Phase 6 in this project's dev compose. The solution is a NestJS `@Cron` job in the extension zone, guarded by the `RUN_CRON` environment flag that already exists in the codebase. The job checks for integrations at 75% of their lifetime and triggers refresh proactively, tracking `lastRefreshedAt`, `tokenExpiration`, and `consecutiveFailures` on the existing Integration model via a Prisma migration.

**Primary recommendation:** Extend the existing Integration model with 3 health-tracking fields via Prisma migration; encrypt tokens using AES-256-GCM at the service layer; wrap upstream OAuth providers with a brand-scoping middleware in the extension zone; use NestJS `@Cron` (not BullMQ, not Temporal) for proactive 75%-lifetime refresh.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js `crypto` (built-in) | Node 20 | AES-256-GCM encryption/decryption | Already used in auth.service.ts for AES-256-CBC; no new dep |
| `@nestjs/schedule` | already in repo | `@Cron` decorator for recurring background jobs | The `RUN_CRON` env var convention already exists in the codebase |
| Prisma (existing) | existing | Schema migration for new Integration fields | Already the ORM; migration file approach established in Phase 1 |
| `@gitroom/nestjs-libraries` (existing) | monorepo | Integration providers, NotificationService, PrismaRepository | All OAuth logic lives here |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dayjs` | existing | Token expiry calculations (75% lifetime check) | Already used throughout codebase for date arithmetic |
| `twitter-api-v2` | existing | X OAuth 1.0a flow | XProvider already uses this |
| `NotificationService` | existing | In-app token failure alerts | Used by upstream RefreshIntegrationService already |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| NestJS @Cron | BullMQ | BullMQ not wired into this project's backend; no queues registered |
| NestJS @Cron | Temporal workflow | Deferred to Phase 6; Temporal not in dev compose |
| AES-256-GCM (new) | AES-256-CBC (existing fixedEncryption) | CBC uses fixed IV — weaker; NF1.1 explicitly says GCM |
| Separate ENCRYPTION_KEY | Reuse JWT_SECRET | Principle of least privilege — separate keys for separate concerns |
| Extension zone @Cron module | Modify libraries/ | Extension zone rule — custom code never in apps/ or libraries/ |

**Installation:** No new packages required. `@nestjs/schedule` is already in the monorepo.

---

## Architecture Patterns

### Recommended Project Structure
```
extensions/
├── credential-management/           # New extension package
│   ├── src/
│   │   ├── encryption/
│   │   │   └── token.encryption.service.ts   # AES-256-GCM encrypt/decrypt
│   │   ├── credential/
│   │   │   ├── credential.service.ts         # Wraps IntegrationService with encryption
│   │   │   ├── credential.repository.ts      # Token health queries
│   │   │   └── credential.controller.ts      # /api/credentials/* endpoints
│   │   ├── oauth/
│   │   │   └── oauth.brand.middleware.ts     # Attaches brandId to OAuth state
│   │   ├── refresh/
│   │   │   └── token.refresh.job.ts          # @Cron 75%-lifetime refresh job
│   │   ├── health/
│   │   │   └── token.health.service.ts       # Health state calculation
│   │   └── credential-management.module.ts  # Registers all above
│   ├── package.json
│   └── tsconfig.json
```

### Pattern 1: AES-256-GCM Token Encryption Service
**What:** Encrypt plaintext tokens before writing to DB; decrypt when reading for use.
**When to use:** Every write to `Integration.token` and `Integration.refreshToken` via the extension service.
**Example:**
```typescript
// extensions/credential-management/src/encryption/token.encryption.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const TAG_LENGTH = 16;

@Injectable()
export class TokenEncryptionService {
  private readonly key: Buffer;

  constructor() {
    const rawKey = process.env.ENCRYPTION_KEY!;
    if (!rawKey) throw new Error('ENCRYPTION_KEY env var is required');
    // Derive a 32-byte key from the provided secret
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // Format: iv(12) + tag(16) + ciphertext — all hex-encoded
    return Buffer.concat([iv, tag, encrypted]).toString('hex');
  }

  decrypt(hexData: string): string {
    const data = Buffer.from(hexData, 'hex');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }

  isEncrypted(value: string): boolean {
    // Encrypted values are hex-encoded; minimum length = (12+16)*2 = 56 chars
    return /^[0-9a-f]+$/.test(value) && value.length >= 56;
  }
}
```

### Pattern 2: Encrypt at Service Layer (Not DB Layer)
**What:** The CredentialService wraps IntegrationService.createOrUpdateIntegration() to encrypt tokens before the upstream call. Reads decrypt immediately after fetch.
**When to use:** All writes of access/refresh tokens go through CredentialService, never directly to IntegrationService.
**Example:**
```typescript
// extensions/credential-management/src/credential/credential.service.ts
@Injectable()
export class CredentialService {
  constructor(
    private readonly integrationService: IntegrationService,
    private readonly encryption: TokenEncryptionService,
  ) {}

  async saveCredential(params: SaveCredentialParams) {
    return this.integrationService.createOrUpdateIntegration(
      params.additionalSettings,
      params.oneTimeToken,
      params.org,
      params.name,
      params.picture,
      'social',
      params.internalId,
      params.provider,
      this.encryption.encrypt(params.token),       // Encrypt before write
      this.encryption.encrypt(params.refreshToken), // Encrypt before write
      params.expiresIn,
      params.username,
      params.isBetweenSteps,
    );
  }

  decryptToken(integration: Integration): string {
    if (!this.encryption.isEncrypted(integration.token)) {
      return integration.token; // Migrate-safe: return plaintext if not yet encrypted
    }
    return this.encryption.decrypt(integration.token);
  }
}
```

### Pattern 3: OAuth Brand Context Middleware
**What:** Intercept the existing `/integrations/social-connect/:provider` flow and attach `brandId` to the OAuth `state` value stored in Redis. After the callback, link the resulting Integration to the correct Brand via SocialAccount.
**When to use:** Connect flow initiated from brand settings page.
**Example:**
```typescript
// extensions/credential-management/src/oauth/oauth.brand.middleware.ts
// In the extension's controller (not modifying upstream controller):
// POST /api/credentials/oauth/start  { provider, brandId, companyId }
//   -> calls upstream generateAuthUrl(), stores brandId in redis:brand:{state}
//   -> returns { url }
//
// Callback hook: POST /api/credentials/oauth/callback  { provider, state, code, ... }
//   -> calls upstream connectSocialMedia()
//   -> retrieves brandId from redis:brand:{state}
//   -> upserts SocialAccount linking Integration.id to Brand
```

### Pattern 4: NestJS @Cron Proactive Refresh Job
**What:** A scheduled job runs every 15 minutes, queries integrations expiring within the warning window, refreshes at 75% lifetime.
**When to use:** Runs only when `process.env.RUN_CRON` is set (existing convention).
**Example:**
```typescript
// extensions/credential-management/src/refresh/token.refresh.job.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import dayjs from 'dayjs';

@Injectable()
export class TokenRefreshJob {
  constructor(
    private readonly credentialRepository: CredentialRepository,
    private readonly refreshService: RefreshIntegrationService,
    private readonly notificationService: NotificationService,
    private readonly credentialService: CredentialService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshExpiringTokens() {
    if (!process.env.RUN_CRON) return;

    const integrations = await this.credentialRepository.findTokensAt75Percent();

    for (const integration of integrations) {
      try {
        const result = await this.refreshService.refresh({
          ...integration,
          token: this.credentialService.decryptToken(integration),
          refreshToken: this.credentialService.decryptRefreshToken(integration),
        });

        if (!result) {
          await this.credentialRepository.incrementFailureCount(integration.id);
          await this.maybeAlertOperator(integration);
        } else {
          await this.credentialRepository.resetFailureCount(integration.id);
        }
      } catch (err) {
        await this.credentialRepository.incrementFailureCount(integration.id);
      }
    }
  }

  private async maybeAlertOperator(integration: Integration) {
    // Alert on 3rd consecutive failure
    if (integration.consecutiveFailures >= 2) {
      await this.notificationService.inAppNotification(
        integration.organizationId,
        `Token refresh failed for ${integration.providerIdentifier}`,
        `Your ${integration.providerIdentifier} connection needs re-authentication.`,
        true,
        false,
        'info'
      );
    }
  }
}
```

### Pattern 5: Token Health State Calculation
**What:** Derive health state from stored fields without live API calls.
**When to use:** Dashboard rendering, settings page.
```typescript
type TokenHealthState = 'healthy' | 'warning' | 'expired' | 'refresh_needed';

function getTokenHealth(integration: {
  tokenExpiration: Date | null;
  refreshNeeded: boolean;
  consecutiveFailures: number;
  lastRefreshedAt: Date | null;
}): TokenHealthState {
  if (integration.refreshNeeded) return 'refresh_needed';
  if (!integration.tokenExpiration) return 'healthy';

  const now = dayjs();
  const expiry = dayjs(integration.tokenExpiration);
  const daysLeft = expiry.diff(now, 'day');

  if (daysLeft < 0) return 'expired';
  if (daysLeft < 7 || integration.consecutiveFailures >= 1) return 'warning';
  return 'healthy';
}
```

### Pattern 6: Prisma Migration for Health Fields
**What:** New migration adds 3 fields to the Integration model.
**When to use:** Applied once via `pnpm run prisma:migrate`.
```prisma
// Migration: 20260310000002_integration_token_health
// Add to Integration model in schema.prisma:
model Integration {
  // ... existing fields ...

  // SOCIAL COMMAND CENTRE — Phase 2: Token health tracking
  lastRefreshedAt      DateTime?
  consecutiveFailures  Int       @default(0)
  // tokenExpiration already exists in upstream model
}
```

### Anti-Patterns to Avoid
- **Decrypting in the DB layer (Prisma middleware):** Decryption happens at service level only — DB middleware runs on all queries including those that don't need decryption, causing performance waste and complexity.
- **Using AuthService.fixedEncryption() for NF1.1:** It is AES-256-CBC with a fixed IV (per-encryption deterministic output). NF1.1 explicitly requires GCM. Do not use for token storage.
- **Forking OAuth providers into extension zone:** The upstream providers are feature-complete. Adding a fork creates maintenance burden. Wrap at the controller/service level instead.
- **Running @Cron without RUN_CRON guard:** Other NestJS services (frontend proxy, API worker) also import NestJS modules. The `RUN_CRON` convention already in the codebase prevents double-scheduling.
- **Storing brandId in the Integration model itself:** Integration is upstream — adding custom fields requires DIVERGENCE.md tracking. Prefer the existing `SocialAccount.integrationId` nullable FK from Phase 1 as the linking point.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth flows for Meta/LinkedIn/X | Custom OAuth handlers | Upstream FacebookProvider, InstagramProvider, LinkedinProvider, XProvider | Already complete with edge cases, permission checks, `isBetweenSteps` page selection, error handling |
| Token refresh after expiry | Custom refresh logic | Existing `RefreshIntegrationService.refresh()` + `refreshProcess()` | Handles all 4 providers, `oneTimeToken` propagation, `reConnect` for page tokens |
| In-app notifications | Custom notification system | `NotificationService.inAppNotification()` | Already wired into upstream infrastructure, used by integration error flows |
| AES encryption | OpenSSL bindings or external lib | Node.js built-in `crypto` module | Available in Node 20, no extra dependencies |
| Cron scheduling | Custom setInterval loop | `@nestjs/schedule` @Cron decorator | Already in monorepo, handles timezone-safe scheduling, plays well with NestJS DI |
| Redis state storage | Custom key-value | Existing `ioRedis` instance | Already used for OAuth state (`login:{state}`, `organization:{state}`) |

**Key insight:** The OAuth implementation in this codebase is more complex than it appears — `isBetweenSteps` for Meta providers, `rootInternalId` for page token propagation, `oneTimeToken` for LinkedIn's single-token-per-user semantics — all of this is already solved in upstream. Wrapping it is far safer than re-implementing it.

---

## Common Pitfalls

### Pitfall 1: Meta Token Lifetime Confusion
**What goes wrong:** Treating Facebook user tokens and page access tokens as having the same expiry. User tokens (long-lived) expire in 60 days. Page access tokens derived from them are technically non-expiring for page operations but bound to the user token's validity.
**Why it happens:** The Facebook `authenticate()` method in `facebook.provider.ts` already exchanges the short-lived token for a long-lived one (`fb_exchange_token`) and sets `expiresIn` to 59 days. The `fetchPageInformation()` call derives the page token but does NOT set a separate expiry.
**How to avoid:** Store the user token expiry as the canonical expiry for all child page tokens. When the user token refreshes (or is revoked), all derived page tokens also become invalid. The `rootInternalId` / `internalId` pattern already tracks this.
**Warning signs:** Page tokens returning `Error validating access token` before `tokenExpiration` is reached.

### Pitfall 2: LinkedIn's oneTimeToken Semantics
**What goes wrong:** Refreshing a LinkedIn token only updates the one integration record but not related page integrations.
**Why it happens:** `LinkedinProvider.oneTimeToken = true` triggers `IntegrationRepository.createOrUpdateIntegration()` to propagate the new token to all integrations sharing the same `rootInternalId`. If refresh bypasses this path, related integrations get stale tokens.
**How to avoid:** Always call `CredentialService.saveCredential()` which internally calls `createOrUpdateIntegration()` with the `oneTimeToken` flag. Never call `integration.update()` directly on a LinkedIn token.
**Warning signs:** LinkedIn Page posts failing with auth errors while the personal LinkedIn integration still works.

### Pitfall 3: X Token Format is Composite
**What goes wrong:** Treating X's `token` as a simple access token. `XProvider.authenticate()` stores the token as `accessToken:accessSecret` (a colon-concatenated composite).
**Why it happens:** X uses OAuth 1.0a, which requires both an access token and an access secret for every API call. The provider concatenates them as a convenience.
**How to avoid:** When decrypting an X token for refresh, the entire `accessToken:accessSecret` string must be encrypted/decrypted as one unit. Do not split before encrypting.
**Warning signs:** X API calls failing with "Unsupported Authentication" after token round-trip through encryption.

### Pitfall 4: Migration Safety for Existing Encrypted Tokens
**What goes wrong:** Applying encryption migration to existing tokens that are already hex-looking strings (e.g., some providers use hex auth codes), causing double-encryption.
**Why it happens:** `isEncrypted()` check is heuristic — valid hex string of sufficient length. Some provider tokens (e.g., Facebook page access tokens) may look like hex strings.
**How to avoid:** Use a prefix marker: encrypted values should start with a sentinel byte pattern (e.g., store as `enc:` + hex). Alternatively, at migration time, run a one-time script that explicitly encrypts all existing token values regardless of content, and updates a `tokenEncrypted = true` flag.
**Recommended approach:** Add `tokenEncrypted Boolean @default(false)` to Integration. Migration script sets tokens + flag in one transaction. After migration, `decryptToken()` only decrypts if `tokenEncrypted = true`.

### Pitfall 5: @Cron Double-Execution in Multi-Process Setup
**What goes wrong:** Both the backend API process and a separate cron worker process run the same @Cron job simultaneously.
**Why it happens:** NestJS modules can be imported in multiple processes. The `RUN_CRON` env var must be set ONLY on the dedicated cron process.
**How to avoid:** Guard every @Cron method body with `if (!process.env.RUN_CRON) return;` (consistent with how `InfiniteWorkflowRegister.onModuleInit()` already works in this codebase). Do NOT use `@Cron` on a class that is conditionally registered — the guard must be inside the method body.
**Warning signs:** `consecutiveFailures` incrementing twice as fast as expected; duplicate notifications.

### Pitfall 6: NF1.1 Key Management
**What goes wrong:** Using `JWT_SECRET` as the encryption key for tokens.
**Why it happens:** It is convenient — JWT_SECRET is already available. But JWT_SECRET is used to sign auth cookies; rotating it invalidates all user sessions. Rotating it would also invalidate all stored tokens if both share the key.
**How to avoid:** Use a separate `ENCRYPTION_KEY` env var. Document in `.env.example`. If ENCRYPTION_KEY is not set, fail loudly at startup (not silently fall back to JWT_SECRET).
**Warning signs:** Needing to rotate JWT_SECRET for auth reasons but being unable to without also re-encrypting all stored tokens.

---

## Code Examples

Verified patterns from existing codebase:

### How Upstream OAuth State Storage Works (ioRedis)
```typescript
// Source: apps/backend/src/api/routes/no.auth.integrations.controller.ts
// OAuth state is stored in Redis as two keys:
// login:{state} -> codeVerifier
// organization:{state} -> organizationId
// These expire naturally (Redis TTL)

// Extension adds a third key:
// brand:{state} -> brandId
// Stored when operator initiates OAuth from brand settings page
```

### How SocialAccount Links to Integration (Phase 1 schema)
```typescript
// Source: schema.prisma (Phase 1)
model SocialAccount {
  id            String   @id @default(uuid())
  brandId       String
  platform      String      // 'instagram', 'facebook', 'linkedin', 'x'
  externalId    String?     // platform's user/page ID
  displayName   String?
  integrationId String?     // FK to Integration.id (nullable — set after OAuth)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  brand         Brand    @relation(fields: [brandId], references: [id], onDelete: Cascade)

  @@unique([brandId, platform])
}
// After OAuth callback: SocialAccount.integrationId = Integration.id
// This is the join point between brand hierarchy and upstream integration
```

### How Upstream needsToBeRefreshed Works (to adapt for 75% check)
```typescript
// Source: libraries/nestjs-libraries/src/database/prisma/integrations/integration.repository.ts
// Upstream checks: tokenExpiration <= now + 1 day
needsToBeRefreshed() {
  return this._integration.model.integration.findMany({
    where: {
      tokenExpiration: {
        lte: dayjs().add(1, 'day').toDate(),
      },
      inBetweenSteps: false,
      deletedAt: null,
      refreshNeeded: false,
    },
  });
}
// Our 75%-lifetime check instead computes refresh time = createdAt + 0.75 * lifetime
// and queries: tokenExpiration IS NOT NULL AND tokenExpiration > NOW() AND
//              (tokenExpiration - createdAt) * 0.75 + createdAt <= NOW()
// Simpler: compute expiresAt - 25% of lifetime and check if that time has passed
```

### How Existing Token Error Handling Triggers Re-auth
```typescript
// Source: libraries/nestjs-libraries/src/integrations/social.abstract.ts
// Providers return this type from handleErrors() when token is bad:
{ type: 'refresh-token', value: 'Please re-authenticate your Facebook account' }
// This becomes a RefreshToken exception which triggers re-auth flow
// Our @Cron job catching failed refreshes should also set refreshNeeded=true on the
// Integration, which integrates with the existing upstream error surfacing
```

### How LinkedIn Expiry Works (for 75% calculation)
```typescript
// Source: libraries/nestjs-libraries/src/integrations/social/linkedin.provider.ts
async authenticate(params) {
  const { access_token, expires_in, refresh_token } = await fetch(tokenEndpoint);
  // LinkedIn access tokens: expires_in typically 5183999 seconds (~60 days)
  // LinkedIn refresh tokens: much longer (365+ days)
  return { accessToken, refreshToken, expiresIn: expires_in, ... };
}
// expiresIn seconds -> stored as tokenExpiration = new Date(Date.now() + expiresIn * 1000)
// 75% of 60 days = 45 days -> refresh trigger at 45 days in
```

### Health Endpoint Response Shape
```typescript
// New GET /api/credentials/health endpoint response shape:
interface TokenHealthResponse {
  integrations: {
    id: string;               // Integration.id
    provider: string;         // providerIdentifier
    name: string;
    picture: string | null;
    brandId: string | null;   // from SocialAccount
    brandName: string | null;
    health: 'healthy' | 'warning' | 'expired' | 'refresh_needed';
    lastRefreshedAt: string | null;   // ISO8601
    expiresAt: string | null;         // ISO8601
    consecutiveFailures: number;
    daysUntilExpiry: number | null;
  }[];
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Temporal workflow for token refresh | @Cron (this project) | Phase 6 deferred Temporal | No Temporal in dev compose — @Cron is the right choice until Phase 6 |
| Tokens stored plaintext | AES-256-GCM at service layer | This phase (NF1.1) | All existing tokens must be migrated in a one-shot script |
| Organization-scoped OAuth | Brand-scoped OAuth (this phase) | Phase 2 | OAuth callback links Integration to Brand via SocialAccount.integrationId |
| Reactive re-auth (operator-triggered) | Proactive refresh at 75% lifetime | This phase (R3.3) | LinkedIn tokens last 60 days; 75% trigger = day 45 |

**Deprecated/outdated:**
- `AuthService.fixedEncryption()` for token storage: Uses AES-256-CBC with a fixed IV (no randomness per encryption). Fine for auth tokens (JWT) but not adequate for NF1.1 OAuth token storage. The existing `encrypt_legacy_using_IV` / `decrypt_legacy_using_IV` pattern can decrypt legacy tokens during migration but must not be used for new token writes.
- `IntegrationService.refreshTokens()` (upstream cron-style helper): This calls `needsToBeRefreshed()` which checks expiry within 1 day — not 75%. It also does not track `consecutiveFailures`. Our Phase 2 job replaces this pattern for the 4 MVP platforms.

---

## Open Questions

1. **Migration of existing plaintext tokens**
   - What we know: Integration.token currently stores plaintext tokens. New code must be backward compatible.
   - What's unclear: Are there any integrations currently active in the dev database that would break during migration?
   - Recommendation: Add `tokenEncrypted Boolean @default(false)` field. Migration script reads all integrations with `tokenEncrypted=false`, encrypts, sets flag to `true`. Decrypt function checks flag before attempting decryption. This is safe to run at startup on any data state.

2. **ScheduleModule already registered?**
   - What we know: `@nestjs/schedule` is in the monorepo (Temporal module is also there). `ScheduleModule.forRoot()` needs to be registered in AppModule or CredentialManagementModule.
   - What's unclear: Whether `ScheduleModule.forRoot()` is already registered somewhere in the app module chain.
   - Recommendation: Register `ScheduleModule.forRoot()` in `CredentialManagementModule` — NestJS is safe with multiple registrations.

3. **X Token Refresh: Non-Expiring**
   - What we know: `XProvider.authenticate()` sets `expiresIn: 999999999` (effectively permanent). `XProvider.refreshToken()` returns empty fields.
   - What's unclear: X OAuth 1.0a access tokens technically do not expire — they can be revoked. The `@Cron` refresh job should skip X tokens.
   - Recommendation: In refresh job, skip integrations where `providerIdentifier === 'x'` OR where `expiresIn >= 999999999`. Still track `consecutiveFailures` for X tokens that fail during publishing.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + ts-jest (same config as multi-company extension) |
| Config file | `extensions/credential-management/jest.config.ts` — Wave 0 |
| Quick run command | `pnpm --filter @social/credential-management test` |
| Full suite command | `pnpm --filter @social/credential-management test --coverage` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| R3.2 | TokenEncryptionService.encrypt() produces different ciphertext each call | unit | `pnpm --filter @social/credential-management test` | Wave 0 |
| R3.2 | TokenEncryptionService.decrypt(encrypt(value)) === value | unit | `pnpm --filter @social/credential-management test` | Wave 0 |
| R3.2 | decryptToken() returns plaintext unchanged if tokenEncrypted=false | unit | `pnpm --filter @social/credential-management test` | Wave 0 |
| NF1.1 | GCM authentication tag verification fails on tampered ciphertext | unit | `pnpm --filter @social/credential-management test` | Wave 0 |
| R3.3 | findTokensAt75Percent() returns integrations past 75% lifetime | unit (mock DB) | `pnpm --filter @social/credential-management test` | Wave 0 |
| R3.3 | @Cron job skips execution when RUN_CRON not set | unit | `pnpm --filter @social/credential-management test` | Wave 0 |
| R3.3 | Refresh failure increments consecutiveFailures | unit (mock) | `pnpm --filter @social/credential-management test` | Wave 0 |
| R3.4 | getTokenHealth() returns 'healthy' / 'warning' / 'expired' correctly | unit | `pnpm --filter @social/credential-management test` | Wave 0 |
| R3.5 | NotificationService called on 3rd consecutive failure | unit (mock) | `pnpm --filter @social/credential-management test` | Wave 0 |
| R3.1 | OAuth brand context stored in Redis during connect start | unit (mock Redis) | `pnpm --filter @social/credential-management test` | Wave 0 |
| R3.6 | SocialAccount.integrationId updated after OAuth callback | integration (requires DB) | `pnpm --filter @social/credential-management test:integration` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @social/credential-management test`
- **Per wave merge:** `pnpm --filter @social/credential-management test --coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `extensions/credential-management/` — package does not exist yet, needs creation
- [ ] `extensions/credential-management/package.json` — workspace package
- [ ] `extensions/credential-management/jest.config.ts` — copy pattern from multi-company
- [ ] `extensions/credential-management/tsconfig.json` + `tsconfig.spec.json` — copy from multi-company
- [ ] `extensions/credential-management/src/__tests__/token.encryption.spec.ts` — covers R3.2, NF1.1
- [ ] `extensions/credential-management/src/__tests__/token.health.spec.ts` — covers R3.4
- [ ] `extensions/credential-management/src/__tests__/token.refresh.job.spec.ts` — covers R3.3, R3.5
- [ ] Prisma migration: `20260310000002_integration_token_health` — adds `lastRefreshedAt`, `consecutiveFailures`, `tokenEncrypted`

---

## Sources

### Primary (HIGH confidence)
- Codebase direct inspection — `libraries/helpers/src/auth/auth.service.ts` — confirms AES-256-CBC with fixed IV via EVP_BytesToKey; GCM is a new implementation
- Codebase direct inspection — `libraries/nestjs-libraries/src/integrations/social/facebook.provider.ts` — confirms `isBetweenSteps=true`, `expiresIn = 59 days`
- Codebase direct inspection — `libraries/nestjs-libraries/src/integrations/social/instagram.provider.ts` — confirms Meta parent-child token flow via `pages()` + `fetchPageInformation()`
- Codebase direct inspection — `libraries/nestjs-libraries/src/integrations/social/linkedin.provider.ts` — confirms `oneTimeToken=true`, `refreshToken()` implementation, `expires_in` field
- Codebase direct inspection — `libraries/nestjs-libraries/src/integrations/social/x.provider.ts` — confirms OAuth 1.0a, composite `accessToken:accessSecret` format, `expiresIn: 999999999`
- Codebase direct inspection — `libraries/nestjs-libraries/src/database/prisma/schema.prisma` — confirms Integration model fields: `token`, `refreshToken`, `tokenExpiration`, `refreshNeeded`, `inBetweenSteps`, `rootInternalId`; Phase 1 `SocialAccount.integrationId` FK
- Codebase direct inspection — `apps/orchestrator/src/workflows/refresh.token.workflow.ts` — confirms Temporal-based refresh exists (but deferred to Phase 6)
- Codebase direct inspection — `libraries/nestjs-libraries/src/temporal/infinite.workflow.register.ts` — confirms `RUN_CRON` env var convention
- Node.js docs (built-in knowledge) — `crypto.createCipheriv('aes-256-gcm')` API, IV length 12 bytes, `getAuthTag()` 16 bytes

### Secondary (MEDIUM confidence)
- Codebase inspection — `apps/backend/src/app.module.ts` — `getTemporalModule(false)` — Temporal client only, no workers in backend; workers are in orchestrator
- Codebase inspection — `extensions/multi-company/jest.config.ts` — established jest test pattern for extension packages

### Tertiary (LOW confidence)
- LinkedIn token lifetime: documentation suggests ~60 day access token, ~365 day refresh token (industry knowledge, not verified against live LinkedIn docs as of 2026-03-10)
- Facebook long-lived token: ~60 days post-exchange (matches code comment `dayjs().add(59, 'days')` — HIGH confidence this is accurate)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in repo; no new dependencies required
- Architecture: HIGH — patterns derived from direct codebase inspection of all four OAuth providers and integration infrastructure
- Pitfalls: HIGH — X token format, LinkedIn oneTimeToken, Meta parent-child all verified from provider source code
- Encryption design: HIGH — AES-256-GCM is well-documented, Node.js crypto is stable

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (platform API versions pinned; Meta Graph API v20.0, LinkedIn API 202601, X API v2 are stable within 30 days)
