# Feature Landscape: Social Media Management

**Domain:** Personal AI-powered social media command centre (solo operator, multi-company)
**Researched:** 2026-03-10
**Confidence:** MEDIUM — Based on training knowledge of Buffer, Hootsuite, Later, Sprout Social, Postiz, Mixpost, and related tools through August 2025. WebSearch/WebFetch unavailable; no live verification performed.

---

## Context: What Makes This System Different

This is NOT a generic social media tool. The use case is highly specific:
- One operator, 5-15 companies, 20-75 accounts, 100+ posts/week, 4+ languages
- AI does the heavy lifting; human does final review and approval
- Self-hosted on VPS; no SaaS dependencies
- Built on an open-source base (Postiz or Mixpost), deeply customised

The feature analysis below is filtered through this lens. "Table stakes" means the system is useless without it FOR THIS USE CASE — not useless in general.

---

## Table Stakes

Features that must exist or the system cannot fulfil its core purpose.

### 1. Multi-Account / Multi-Company Management

**Why expected:** The entire premise is managing 5-15 companies. Without first-class multi-company isolation, data bleeds between brands and the system is unusable.
**Complexity:** High — requires a multi-tenant data model layered on top of what most OSS tools built for single-workspace use
**Notes:** Postiz and Mixpost have workspace concepts but were not designed for 15 companies. Requires extending the data model with a Company → Brand → Account hierarchy.

### 2. Platform Publishing: Instagram, Facebook, LinkedIn, X, TikTok, Pinterest, Google Business, YouTube Shorts

**Why expected:** Core function. Missing any major platform forces fragmentation back to manual tools.
**Complexity:** High — each platform has its own OAuth flow, rate limits, post format requirements, and API quirks. TikTok and Pinterest have restricted developer programs. YouTube Shorts requires video API handling.
**Notes:**
- Instagram: requires Meta Business API (no personal account direct publishing for Reels/Stories via API — these may require notification-based workarounds)
- TikTok: Content Posting API has approval requirements and video-only format
- Google Business: uses Google My Business API (posts expire after 7 days)
- Pinterest: requires Pinterest API v5 approval for publishing
- YouTube Shorts: uses YouTube Data API v3 with video upload endpoint; Shorts are standard uploads with vertical aspect ratio and correct duration

### 3. Scheduling Engine

**Why expected:** 100+ posts/week across dozens of accounts cannot be managed manually.
**Complexity:** Medium — queue-based scheduling with per-timezone, per-company, per-platform posting windows is non-trivial but well-understood
**Notes:** Must support: draft, scheduled, publishing, published, failed states. Retry logic on failure is critical at this volume. Per-company posting frequency caps prevent spam flags.

### 4. AI Content Generation

**Why expected:** One person generating 100+ original posts/week without AI is not feasible.
**Complexity:** High — requires prompt engineering, per-company brand voice configuration, multi-language output, platform-specific formatting, and confidence scoring
**Notes:** Must be provider-agnostic (OpenAI, Anthropic, local). Each company needs its own system prompt context (brand voice, tone, industry, target audience, do-not-mention list).

### 5. Platform-Specific Caption Adaptation

**Why expected:** A LinkedIn post (2,000 chars, professional, hashtags minimal) cannot be copy-pasted to X (280 chars) or Instagram (2,200 chars, emoji-heavy, hashtags prominent). Without adaptation, content quality suffers.
**Complexity:** Medium — AI-driven rewriting per platform format rules; requires knowing each platform's norms
**Notes:** Caption length limits: X 280, Instagram 2200, Facebook 63,206, LinkedIn 3,000, TikTok 2,200, Pinterest 500, Google Business 1,500, YouTube Shorts description 5,000.

### 6. Media Library (Per-Company)

**Why expected:** At this volume, media must be organised and reusable. Without a library, every post requires re-uploading assets.
**Complexity:** Medium — file storage with folder hierarchy (company/brand/campaign/season), thumbnail generation, and metadata tagging
**Notes:** Storage backend should be configurable (local filesystem, S3-compatible). Per-company isolation is mandatory.

### 7. Media Processing

**Why expected:** Different platforms require different image/video dimensions. Without processing, manual resizing is required per post per platform.
**Complexity:** Medium — server-side image/video processing using Sharp or FFmpeg. Standard transformations well-understood.
**Notes:** Required transforms: crop/resize per platform spec, add watermark/logo, carousel creation (multiple images as one post), quote card generation, video clip extraction, subtitle burning for video.

### 8. Publishing Engine with Retry and Logging

**Why expected:** At 100+ posts/week, failures will occur. Without a robust publishing engine, failed posts go unnoticed.
**Complexity:** Medium — job queue (Bull/BullMQ or similar), retry with exponential backoff, failure logging, operator alerts
**Notes:** Every publish attempt must be logged with response code, timestamp, and payload. Failed posts must surface in the dashboard without operator having to audit manually.

### 9. AI Confidence Gating / Review Queue

**Why expected:** AI-generated content has variable quality. Publishing directly to client company accounts without human review is risky at this operator's accountability level.
**Complexity:** Low-Medium — scoring system that flags content below a threshold; a review queue where operator approves/edits before scheduling
**Notes:** This is a safety valve. The operator must be able to see all AI-drafted content in a "pending review" state before it enters the scheduling queue.

### 10. Personal Dashboard

**Why expected:** With 15 companies, the operator has no idea what needs attention without a unified view.
**Complexity:** Medium — aggregates state across all companies: posts failing, content gaps detected, engagement outliers, items in review queue, today's publishing schedule
**Notes:** Must show: today's queue, failures requiring intervention, companies with content gaps, posts pending approval, top-performing content from last 7 days.

### 11. Analytics: Engagement Metrics Per Post and Per Account

**Why expected:** Without metrics, the operator cannot know what content is working or justify the posting strategy.
**Complexity:** Medium-High — requires pulling metrics from each platform's API (impressions, reach, likes, comments, shares, saves, clicks) and storing in a local database for querying
**Notes:** Each platform exposes different metrics. Normalise into common dimensions: reach, engagements, engagement_rate, clicks. Store raw platform data separately.

### 12. Multi-Language Content Support

**Why expected:** 4+ languages is a stated requirement. Without language configuration per company, all AI output defaults to one language.
**Complexity:** Medium — per-company language settings; AI generation prompt instructs language; translation workflow for source-to-target when repurposing
**Notes:** Languages: at minimum English, Greek (given operator context), and others per company configuration. Must handle right-to-left scripts if Arabic or Hebrew is needed. Character encoding throughout stack must be UTF-8.

### 13. Input Workflow: Upload Media + Optional Text → AI Generates Everything

**Why expected:** This is the primary operator workflow. Upload a product photo, optionally add context ("new summer collection"), and receive platform-ready captions with hashtags, CTAs, and variants.
**Complexity:** High — combines media upload, AI vision (understand image content), caption generation, hashtag suggestion, CTA variation, and platform adaptation in one pipeline
**Notes:** AI vision (multimodal) is needed for image understanding. GPT-4o, Claude 3.5 Sonnet, or Llama 3.2 Vision are viable providers.

---

## Differentiators

Features that are not found in generic tools and make this specific system valuable for a solo operator managing many companies.

### 1. Per-Company Brand Voice Configuration

**Value proposition:** Each of the 15 companies has a unique identity. AI content must respect each brand's tone, vocabulary, no-go topics, and audience language — not produce generic output.
**Complexity:** Medium — configuration schema per company stored in DB; injected as system context into every AI call for that company
**Notes:** Schema should include: brand name, industry, tone descriptors (formal/casual/playful/authoritative), target audience personas, preferred hashtags, blacklisted words, competitor do-not-mention list, sample posts as few-shot examples.

### 2. Content Repurposing Pipeline

**Value proposition:** A blog post, product description, or customer review should generate 5-10 social posts automatically across platforms and languages.
**Complexity:** High — extraction of key claims from long-form content, reframing per content type (educational → carousel, testimonial → quote card, product → promotional post), then platform adaptation
**Notes:** Input types to support: URL (scrape/fetch article), pasted text, PDF, uploaded document. Output: platform-ready posts in all configured languages for that company.

### 3. Evergreen Post Recycling

**Value proposition:** High-performing evergreen content (how-to posts, product explainers) should be automatically re-queued after a cooldown period, reducing content creation burden.
**Complexity:** Low-Medium — flag posts as evergreen; scheduling engine re-queues after configurable interval (e.g., 90 days); deduplication prevents same-week repeats
**Notes:** Recycled posts should optionally be refreshed by AI (rewrite slightly to avoid exact duplicate detection by platforms).

### 4. Content Gap Detection

**Value proposition:** With 15 companies, it is easy to neglect one. Automated detection of "this company hasn't posted on platform X in N days" surfaces gaps before they become problems.
**Complexity:** Low — query last publish timestamp per company/platform combination; alert when gap exceeds configurable threshold
**Notes:** Thresholds should be per-platform (Instagram: 3 days gap is a concern; Google Business: 14 days). Surface in dashboard with one-click "generate content for this gap."

### 5. AI-Powered Hashtag Intelligence

**Value proposition:** Generic tools offer hashtag suggestions; this system learns which hashtags actually drive reach for each company/platform over time.
**Complexity:** Medium-High — requires correlating post metrics with hashtags used; build per-company hashtag performance history; AI suggests based on historical performance + trend signals
**Notes:** Initial version can use AI suggestion without historical data; later phases add performance correlation.

### 6. Growth and Performance Intelligence

**Value proposition:** The operator needs to know which company is growing fastest, which platforms deliver best ROI per post effort, and which content types perform best per company.
**Complexity:** Medium — aggregation queries over stored analytics data; weekly/monthly report generation; growth rate calculation across time windows
**Notes:** Outputs: weekly per-company performance digest, cross-company platform ranking ("LinkedIn is your best ROI platform for Company X"), best-performing content type per company.

### 7. Enquiry Categorisation in Inbox

**Value proposition:** DMs and comments from 75 accounts cannot be triaged manually. AI categorisation (sales lead, complaint, question, partnership enquiry, spam) routes messages to the right response workflow.
**Complexity:** Medium — requires reading messages via platform APIs (where available: Meta, LinkedIn, X DMs), classifying with AI, and surfacing high-priority items
**Notes:** Not all platforms expose DMs/comments via API. Instagram and Facebook via Meta Conversations API; LinkedIn messages via API; X (Twitter) DMs via API. TikTok and Pinterest comment APIs are limited.

### 8. UTM Tagging and Link Management

**Value proposition:** Tracking conversion from social posts requires consistent UTM parameters. Manual UTM construction at 100+ posts/week is error-prone.
**Complexity:** Low-Medium — auto-generate UTM parameters (utm_source=platform, utm_medium=social, utm_campaign=company-slug, utm_content=post-id); optionally shorten via configurable URL shortener
**Notes:** UTM scheme should be configurable per company. Integration with a self-hosted URL shortener (Shlink) is a nice-to-have.

### 9. Video Processing Pipeline (Clips + Subtitles)

**Value proposition:** Long-form video → multiple short clips for YouTube Shorts/TikTok/Instagram Reels is a high-value workflow for product demonstrations and educational content.
**Complexity:** High — FFmpeg-based clip extraction; AI-generated subtitle SRT via Whisper transcription; subtitle burning; aspect ratio conversion for platform requirements
**Notes:** This is technically complex but high ROI. Whisper (local) or OpenAI Whisper API for transcription. FFmpeg for all video transformations.

### 10. Scheduling Rules Engine (Per-Company, Per-Platform)

**Value proposition:** Different companies have different optimal posting times and frequency caps. A food brand posts at lunch and dinner; a B2B LinkedIn brand posts Tuesday-Thursday 9-11am.
**Complexity:** Medium — per-company scheduling profiles with time windows, frequency caps per platform per day/week, blackout periods (holidays per country), timezone configuration
**Notes:** Optimal posting time suggestions based on historical engagement data (later phase). Initial version uses configurable windows.

### 11. Carousel and Quote Card Generation

**Value proposition:** Carousels are the highest-engagement format on Instagram and LinkedIn. Generating them from text content (listicles, tips, stats) automatically is a significant time saver.
**Complexity:** High — requires server-side image composition (Sharp or Canvas API); template system per brand (fonts, colours, logo placement); AI generates the text content for each slide
**Notes:** Template management is complex. Start with 2-3 configurable templates per company. Full dynamic template editor is a later-phase feature.

---

## Anti-Features

Things to deliberately NOT build.

### 1. Client Portals / External User Access

**Why avoid:** This is a solo-operator system. Building client portals adds authentication complexity, permission systems, data isolation for external users, and UX for non-technical clients. Zero ROI for this use case.
**What to do instead:** Export reports as PDF/email for any stakeholder communication needed.

### 2. Multi-User Team Collaboration Workflows

**Why avoid:** Approval chains, comment threads on posts, role-based permissions for a team — none of this applies when one person operates the system. It adds UI and data model complexity with no benefit.
**What to do instead:** Single-user authentication. Operator is admin and the only user.

### 3. Multi-Tenant Billing / Subscription Management

**Why avoid:** No paying customers. Building billing infrastructure (Stripe integration, subscription tiers, usage metering) is pure waste.
**What to do instead:** Nothing. This is internal tooling.

### 4. Public API / Webhooks for External Clients

**Why avoid:** No external systems need to push into or pull from this system.
**What to do instead:** If integrations are needed (e.g., a Zapier trigger), they can be added later as a specific integration, not a generic public API.

### 5. Native Mobile App

**Why avoid:** The operator works from a desktop. Building iOS/Android apps doubles the UI surface area for no stated benefit.
**What to do instead:** Responsive web UI that works on mobile browser if occasionally needed.

### 6. In-App Social Network (Community Features)

**Why avoid:** Some tools (Postiz) have community/marketplace features for sharing post ideas. Not relevant for a private operator system.
**What to do instead:** Nothing.

### 7. White-Label / Agency Reselling

**Why avoid:** Out of scope per project definition. Adds branding management complexity.
**What to do instead:** Nothing.

### 8. Comment Reply Automation (Auto-Respond)

**Why avoid:** Automated AI replies to comments without human review risks brand damage. The value of inbox monitoring is surfacing messages for human response, not automating replies.
**What to do instead:** Surface, categorise, and prioritise — but require operator to write/approve all replies.

### 9. Social Listening / Competitor Tracking via Scraping

**Why avoid:** Scraping violates platform ToS. This is a hard constraint from PROJECT.md.
**What to do instead:** Use only official API data for analytics. For competitor intelligence, keep it manual.

### 10. Complex A/B Testing Infrastructure

**Why avoid:** At 100+ posts/week across many companies, formal A/B testing (split audiences, statistical significance tracking) is over-engineered. Simple performance tracking is sufficient.
**What to do instead:** Track post performance metrics; surface best/worst content by engagement rate. Let the operator draw their own conclusions.

---

## Feature Dependencies

```
[Company/Brand/Account Data Model]
  → Multi-Account Management
  → Per-Company Brand Voice Config
  → Media Library (Per-Company)
  → Scheduling Rules Engine
  → Analytics (Per-Company)
  → Content Gap Detection

[AI Content Generation]
  → Per-Company Brand Voice Config (must exist first)
  → AI Confidence Gating / Review Queue
  → Platform-Specific Caption Adaptation
  → Hashtag Intelligence
  → Enquiry Categorisation

[Media Processing]
  → Media Library (must exist first)
  → Input Workflow (upload → generate)
  → Carousel/Quote Card Generation
  → Video Processing Pipeline

[Publishing Engine]
  → Scheduling Engine (must exist first)
  → Platform APIs (OAuth, credentials per account)
  → Retry/Failure Logging
  → UTM Tagging (applied at publish time)

[Analytics]
  → Publishing Engine (must be publishing to collect data)
  → Platform API metric pulls
  → Growth/Performance Intelligence (requires historical data accumulation)
  → Hashtag Intelligence (requires historical data)

[Dashboard]
  → Analytics (aggregated view)
  → Content Gap Detection
  → Review Queue
  → Publishing Engine failures feed

[Content Repurposing]
  → AI Content Generation (core pipeline)
  → Platform-Specific Caption Adaptation
  → Multi-Language Support

[Video Processing]
  → Media Library
  → FFmpeg (system dependency)
  → AI Transcription (Whisper — separate from LLM provider)
```

---

## MVP Definition

The minimum viable system that allows the operator to replace their current fragmented workflow.

### MVP Must Have

1. **Multi-company data model** — Company → Brand → Account hierarchy with per-company settings
2. **Platform OAuth and publishing** — At minimum: Instagram, Facebook, LinkedIn, X (the four highest-ROI platforms)
3. **Scheduling engine** — Draft → Scheduled → Published/Failed states with retry
4. **Basic AI caption generation** — Per-company brand voice config, single-language output, manual trigger per post
5. **Input workflow** — Upload image/video + optional context → AI generates captions → operator reviews → schedules
6. **AI confidence gating** — Flag low-confidence drafts for review; no blind auto-publish
7. **Media library** — Per-company folders, upload, reuse
8. **Basic image processing** — Resize per platform, not full carousel/video pipeline
9. **Personal dashboard** — Queue status, recent failures, review items
10. **Basic analytics** — Store engagement metrics pulled from platform APIs; per-post view

### MVP Defer

- TikTok, Pinterest, Google Business, YouTube Shorts (add in Phase 2)
- Multi-language / translation pipeline
- Content repurposing from long-form source
- Evergreen recycling
- Carousel and quote card generation
- Video clip extraction and subtitles
- Content gap detection
- Hashtag intelligence with historical performance
- Weekly/monthly analytics reports
- Enquiry categorisation / inbox monitoring
- UTM tagging automation

### MVP Rationale

Core loop must work first: upload media → AI generates captions with brand voice → operator reviews → schedules → publishes → metrics collected. Everything else adds value on top of this loop. The four major platforms (Instagram, Facebook, LinkedIn, X) cover ~80% of the target posting volume. Additional platforms can be added once the publishing engine is proven stable.

---

## Feature Prioritization Matrix

| Feature | Impact | Complexity | Phase |
|---------|--------|------------|-------|
| Company/Brand/Account data model | Critical | High | 1 — Foundation |
| Instagram + Facebook publishing (Meta API) | Critical | High | 1 — Foundation |
| LinkedIn publishing | Critical | Medium | 1 — Foundation |
| X (Twitter) publishing | Critical | Medium | 1 — Foundation |
| Scheduling engine (queue + states + retry) | Critical | Medium | 1 — Foundation |
| Per-company brand voice config | Critical | Medium | 1 — Foundation |
| AI caption generation (single language) | Critical | High | 1 — Foundation |
| Input workflow (upload → generate → review) | Critical | Medium | 1 — Foundation |
| AI confidence gating + review queue | Critical | Low | 1 — Foundation |
| Media library (per-company) | High | Medium | 1 — Foundation |
| Basic image resize per platform | High | Low | 1 — Foundation |
| Personal dashboard | High | Medium | 1 — Foundation |
| Basic analytics (store + display per post) | High | Medium | 1 — Foundation |
| TikTok publishing | High | High | 2 — Platform Expansion |
| YouTube Shorts publishing | High | High | 2 — Platform Expansion |
| Pinterest publishing | Medium | Medium | 2 — Platform Expansion |
| Google Business publishing | Medium | Medium | 2 — Platform Expansion |
| Multi-language / translation pipeline | High | Medium | 2 — Platform Expansion |
| Platform-specific caption adaptation | High | Medium | 2 — Platform Expansion |
| UTM tagging automation | Medium | Low | 2 — Platform Expansion |
| Content gap detection | High | Low | 3 — Intelligence |
| Evergreen post recycling | Medium | Medium | 3 — Intelligence |
| Enquiry categorisation / inbox monitoring | High | Medium | 3 — Intelligence |
| Weekly/monthly analytics reports | High | Medium | 3 — Intelligence |
| Growth/performance intelligence | Medium | Medium | 3 — Intelligence |
| Content repurposing pipeline (long-form → posts) | High | High | 4 — AI Enhancement |
| Carousel generation from text | High | High | 4 — AI Enhancement |
| Quote card generation | Medium | Medium | 4 — AI Enhancement |
| AI hashtag intelligence (historical) | Medium | High | 4 — AI Enhancement |
| Video clip extraction (long → shorts) | High | High | 5 — Media Pipeline |
| AI subtitle generation (Whisper) | High | Medium | 5 — Media Pipeline |
| Scheduling rules engine (per-company windows) | Medium | Medium | 3 — Intelligence |
| Logo/watermark application | Low | Low | 2 — Platform Expansion |

---

## Platform API Complexity Notes

Relevant for roadmap phase sequencing.

| Platform | API Complexity | Key Constraints |
|----------|---------------|-----------------|
| Facebook | Medium | Meta Business API; page posts straightforward; stories/reels require different endpoints |
| Instagram | High | Meta Business API; image/video must be uploaded first to a container then published; Reels require separate flow; no direct story scheduling via API |
| LinkedIn | Medium | LinkedIn Marketing API; requires `w_member_social` scope; organization posts require company page admin |
| X (Twitter) | Medium | X API v2; free tier heavily rate-limited (17 posts/day per app on Basic tier); API costs may be significant at volume |
| TikTok | High | Content Posting API; requires business account and API approval; video only (no image posts); strict content policy review |
| Pinterest | Medium | Pinterest API v5; requires app approval for publishing; pin creation is relatively straightforward once approved |
| Google Business | Low-Medium | My Business API; posts expire after 7 days; event and offer post types differ from standard |
| YouTube Shorts | Medium | YouTube Data API v3; video upload then update metadata; Shorts = vertical video under 60s; no special Shorts-specific endpoint |

---

## Competitive Feature Gap Analysis

What generic tools (Buffer, Hootsuite, Later, Sprout Social) provide vs what this system needs.

| Feature Category | Generic Tools | This System Needs | Gap |
|------------------|--------------|-------------------|-----|
| Multi-workspace | Yes (limited) | 15 companies, full isolation | Partial — extend OSS base |
| Scheduling | Yes | Yes + per-company rules | Close |
| AI captions | Basic (generic) | Per-brand voice, confidence gating | Significant |
| AI vision | Some (GPT-4o) | Yes, required for input workflow | Moderate |
| Multi-language | No / basic | 4+ languages, translation pipeline | Significant |
| Content repurposing | No | Blog/product → multi-platform posts | Full gap |
| Evergreen recycling | Buffer only | Yes | Partial |
| Video processing | No | Clip extraction + subtitles | Full gap |
| Carousel generation | Canva integrations | Native with brand templates | Full gap |
| Content gap detection | No | Yes, per-company-platform | Full gap |
| Inbox (comment/DM) | Yes | Yes + AI categorisation | Moderate |
| Analytics | Basic | Per-company, cross-company ranking | Moderate |
| UTM auto-tagging | Some | Yes | Moderate |
| Self-hosted | No (SaaS only) | Required | Full gap |
| Provider-agnostic AI | No | Required | Full gap |

---

## Sources

**Confidence note:** Web access was not available during this research session. All findings are based on training data knowledge of the social media management ecosystem as of August 2025, cross-referenced against the detailed project specification in PROJECT.md. Specific items to validate with live sources:

- Current X (Twitter) API v2 rate limits and pricing tiers (changed significantly 2023-2025)
- TikTok Content Posting API current approval requirements and availability
- Instagram Reels/Stories scheduling API current capabilities (Meta updates these frequently)
- Pinterest API v5 current developer program status
- Postiz and Mixpost current feature sets (both are active OSS projects, features change)

Confidence levels:
- Platform support, generic scheduling, publishing patterns: HIGH (well-established)
- AI feature patterns and complexity estimates: MEDIUM (based on known LLM capabilities)
- API-specific constraints and limits: MEDIUM (correct as of training, may have changed)
- OSS base project feature sets: LOW (active development, verify against current repos)
