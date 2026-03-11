# Social Command Centre — Manual Smoke Test Checklist

This checklist covers production verification steps that require real API tokens, OAuth flows, and live social platform accounts. Run this after `scripts/smoke-test.sh` passes all automated assertions.

**Purpose:** Confirm the full core loop works end-to-end in the production environment:
connect -> generate -> review -> schedule -> publish -> metrics

---

## Section 1 — Prerequisites

Before starting the manual checklist, confirm the following:

- [ ] System is running via `docker compose -f docker-compose.prod.yaml up -d`
- [ ] All containers healthy: `docker compose -f docker-compose.prod.yaml ps` shows all services as "healthy" or "running"
- [ ] Automated smoke test passes: `bash scripts/smoke-test.sh` exits 0
- [ ] Operator account created (registration completed or user created via admin)
- [ ] At least one Company and one Brand configured in the system
- [ ] `.env` file has valid `ENCRYPTION_KEY`, `JWT_SECRET`, `POSTGRES_PASSWORD`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`
- [ ] Domain is live: `https://<your-domain>/` loads the application

---

## Section 2 — OAuth Connect Flow

Test that social platform credentials can be connected via OAuth.

**Instagram (Meta Business):**
- [ ] Navigate to Token Health dashboard for the target Brand
- [ ] Click "Connect Instagram" (or equivalent OAuth start button)
- [ ] Complete Meta Business OAuth flow in the popup/redirect
- [ ] Verify redirect returns to the application without error
- [ ] Verify Instagram account appears in the connected accounts list
- [ ] Verify token health dashboard shows Instagram connection as **Healthy**

**Facebook:**
- [ ] Click "Connect Facebook" (Meta Business OAuth, same app as Instagram)
- [ ] Select a Facebook Page during OAuth
- [ ] Verify redirect returns to the application without error
- [ ] Verify Facebook Page appears in the connected accounts list
- [ ] Verify token health dashboard shows Facebook connection as **Healthy**

**LinkedIn:**
- [ ] Click "Connect LinkedIn"
- [ ] Complete LinkedIn OAuth flow
- [ ] Verify LinkedIn profile or page appears in the connected accounts list
- [ ] Verify token health dashboard shows LinkedIn connection as **Healthy**

**X (Twitter):**
- [ ] Click "Connect X"
- [ ] Complete X OAuth 1.0a flow (app must have Read+Write permissions)
- [ ] Verify X account appears in the connected accounts list
- [ ] Verify token health dashboard shows X connection as **Healthy**

**All connections:**
- [ ] Token health dashboard shows all 4 connections with no alerts
- [ ] No "consecutiveFailures" alerts visible in dashboard

---

## Section 3 — Content Generation

Test that AI-powered content generation produces platform-adapted captions.

- [ ] Navigate to Media Library and upload a test image (JPEG, under 8MB)
- [ ] Verify the image appears in the media library grid
- [ ] Navigate to content creation / new post
- [ ] Select the uploaded image
- [ ] Enter a content brief (e.g. "Product launch announcement for our new widget")
- [ ] Select target platforms: Instagram, Facebook, LinkedIn, X
- [ ] Click "Generate" (or equivalent action)
- [ ] Verify AI-generated captions appear for each platform (platform-adapted tone/length)
- [ ] Verify confidence score is displayed on each generated variant
- [ ] If any variant has confidence score **below the configured threshold** (default 0.7):
  - [ ] Verify that variant appears in the Review Queue automatically
  - [ ] Verify the post is NOT auto-approved for low-confidence content

---

## Section 4 — Review and Scheduling

Test the approval workflow and scheduling calendar.

- [ ] Navigate to Review Queue
- [ ] Verify at least one post is pending review
- [ ] Click "Approve" on one variant — verify it moves out of the Review Queue
- [ ] (Optional) Click "Reject" on another variant — verify it returns to DRAFT status
- [ ] (Optional) Edit a caption inline and click "Approve" — verify edited text is saved

**Scheduling:**
- [ ] Navigate to an approved post (status = APPROVED)
- [ ] Set a scheduled publish time (at least 5 minutes in the future)
- [ ] Click "Schedule" — verify post status changes to SCHEDULED
- [ ] Navigate to the Scheduling Calendar
- [ ] Verify the scheduled post appears on the correct date/time slot in the calendar
- [ ] Verify clicking the calendar slot opens the post details

---

## Section 5 — Publishing

Test that scheduled posts are actually published to the target platforms.

- [ ] Wait for the scheduled publish time to pass (or manually trigger if test tooling available)
- [ ] Verify the post status changes from SCHEDULED to PUBLISHED
- [ ] Check publish attempt log (if visible in dashboard) shows "success" entry
- [ ] Manually verify on the target social platform that the post appears
  - [ ] Instagram: check the connected Instagram account's feed
  - [ ] Facebook: check the connected Facebook Page
  - [ ] LinkedIn: check the connected LinkedIn profile/page
  - [ ] X: check the connected X account's timeline

---

## Section 6 — Analytics

Test that post performance metrics are ingested after publishing.

- [ ] Wait for T+1 hour after publishing (analytics ingestion cron runs hourly)
- [ ] Navigate to the analytics section
- [ ] Verify the published post appears with performance metrics:
  - [ ] Impressions count is populated (non-zero)
  - [ ] Likes/reactions count is populated
  - [ ] At least one engagement metric is showing
- [ ] Navigate to the Dashboard (if available)
- [ ] Verify the published post appears in "Today's Posts" or "Top Performing" widget
- [ ] Verify analytics summary metrics update after ingestion

---

## Section 7 — Failure Scenarios

Test that the system handles failures gracefully and surfaces them to the operator.

**Token Revocation:**
- [ ] In the social platform settings (e.g. Instagram app settings), revoke the app's access token
- [ ] Wait for the token health check cron to run (runs every 30 minutes) OR manually trigger
- [ ] Verify the dashboard shows an alert for the revoked token
- [ ] Verify the token health dashboard marks the integration as "Error" or "Unhealthy"
- [ ] Verify no crash occurs — other integrations remain healthy

**Publishing Failure:**
- [ ] Connect a secondary test account with intentionally invalid credentials (wrong token)
- [ ] Schedule a post using the invalid credentials
- [ ] Wait for the scheduler to attempt publishing
- [ ] Verify the post moves to **FAILED** status (not stuck in PUBLISHING)
- [ ] Verify the failed post appears in the dashboard failures panel or failed posts list
- [ ] Verify retry is available for the failed post

**Stale Post:**
- [ ] Schedule a post for a time already in the past (or a time more than 4 hours ago if the system uses a publish window)
- [ ] Verify the system transitions the post to **STALE** (not PUBLISHED, not stuck in SCHEDULED)
- [ ] Verify the stale post is visible in the failures/attention panel in the dashboard

---

## Section 8 — Graceful Degradation (NF2.4)

**Requirement NF2.4:** The system must remain operational for manual post creation even when no AI provider API keys are configured.

This section requires a restart of the application with AI env vars removed.

**Setup:**
- [ ] Stop the application: `docker compose -f docker-compose.prod.yaml down`
- [ ] Edit `.env` and comment out or remove:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `OLLAMA_URL` (if set)
- [ ] Restart: `docker compose -f docker-compose.prod.yaml up -d`
- [ ] Verify application starts successfully (no startup crash)
- [ ] Run automated smoke: `bash scripts/smoke-test.sh` — should still pass (health checks, SSRF, API availability)

**Manual post creation without AI:**
- [ ] Log in to the application
- [ ] Navigate to create a new post
- [ ] Type a caption manually (do NOT click "Generate")
- [ ] Select target platforms
- [ ] Schedule the post for a near-future time
- [ ] Verify the post is **created successfully** (status: DRAFT or SCHEDULED)
- [ ] Verify the post is **published successfully** at the scheduled time
- [ ] Verify no 500 errors or application crashes occur during this flow

**AI generation attempt without keys (expected graceful error):**
- [ ] Click "Generate" (attempt AI generation without any API keys configured)
- [ ] Verify the system returns a **clear error message** to the user (e.g. "No AI provider configured")
- [ ] Verify the application does **NOT crash** or return a 500 error
- [ ] Verify the user can still manually type and save the post after the error

**Teardown:**
- [ ] Stop: `docker compose -f docker-compose.prod.yaml down`
- [ ] Restore AI env vars in `.env`
- [ ] Restart: `docker compose -f docker-compose.prod.yaml up -d`
- [ ] Verify AI generation works again

---

## Completion Sign-Off

After completing all sections, record the results here:

| Section | Result | Notes |
|---------|--------|-------|
| 1 — Prerequisites | [ ] Pass / [ ] Fail | |
| 2 — OAuth Connect Flow | [ ] Pass / [ ] Fail | |
| 3 — Content Generation | [ ] Pass / [ ] Fail | |
| 4 — Review and Scheduling | [ ] Pass / [ ] Fail | |
| 5 — Publishing | [ ] Pass / [ ] Fail | |
| 6 — Analytics | [ ] Pass / [ ] Fail | |
| 7 — Failure Scenarios | [ ] Pass / [ ] Fail | |
| 8 — Graceful Degradation (NF2.4) | [ ] Pass / [ ] Fail | |

**Tested by:** ______________________________
**Date:** ______________________________
**Environment:** ______________________________
**All sections passed?** [ ] Yes — System is production-ready  [ ] No — See notes above

---

*Generated by Phase 8 Plan 04 — Production Smoke Testing*
*Companion script: `scripts/smoke-test.sh` (automated assertions)*
