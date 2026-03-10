# Stack Research

**Domain:** Self-hosted AI-powered social media management
**Researched:** 2026-03-10
**Confidence:** HIGH (live GitHub and web verification performed)

## Candidate Evaluation

### Postiz
- **Repo:** github.com/gitroomhq/postiz-app
- **Stars:** 27.2k | **Contributors:** 70 | **License:** AGPL-3.0
- **Last release:** Mar 6, 2026 (actively maintained)
- **Stack:** TypeScript, NestJS (backend), Next.js 14 (frontend), PostgreSQL (Prisma ORM), Redis, BullMQ/Temporal (jobs), pnpm monorepo
- **Docker:** Yes, docker-compose included
- **Platforms:** Instagram, Facebook, LinkedIn, X, TikTok, YouTube, Pinterest, Threads, Reddit, Discord, Mastodon, Bluesky, Google Business, Dribbble, Slack (19+)
- **AI:** Built-in AI content assistant + AI image generation (Canva-like editor)
- **Scheduling:** Full scheduling with calendar, queue, repeated posts, RSS auto-post
- **Media:** Media library, built-in design tool, Uppy uploads, Sharp processing, S3/R2 storage
- **Analytics:** Engagement, reach, audience demographics
- **Multi-account:** Yes, workspace-based
- **API:** Public REST API, n8n/Make/Zapier integrations
- **Auth:** JWT + OAuth (Google, GitHub), role-based (SUPERADMIN/ADMIN/USER)
- **Extension:** Provider pattern (SocialAbstract base class), decorator system (@Rules, @Plug, @PostPlug, @Tool), NestJS DI
- **DB:** PostgreSQL via Prisma, clean schema with Organization/User/Integration/Post/Media/Subscription entities

### Mixpost
- **Repo:** github.com/inovector/mixpost
- **Stars:** 3k | **Forks:** 445 | **License:** MIT
- **Last commit:** Feb 24, 2026 (v2.5.0)
- **Stack:** PHP (Laravel), Vue 3 (Inertia.js), TailwindCSS, MySQL/PostgreSQL
- **Docker:** Yes (community Docker, Railway one-click)
- **Platforms (Lite/Free):** Facebook, X, Mastodon only
- **Platforms (Pro/Paid):** + Instagram, LinkedIn, YouTube, TikTok, Pinterest, Threads, Bluesky, Google Business
- **AI:** "AI Compose Post" mentioned but limited detail
- **Scheduling:** Calendar, queue, post conditions, automation
- **Media:** Media library with stock integration, GIFs, video support
- **Analytics:** Engagement metrics, follower activity (Pro)
- **Multi-account:** Unlimited accounts per platform
- **API:** API reference available
- **Auth:** Laravel auth, workspace/team model
- **Extension:** Laravel package architecture, but Pro features behind paid license
- **Critical issue:** Lite version only supports 3 platforms. Full platform support requires Mixpost Pro (paid, one-time license, not fully open-source)

### Socioboard 5.0
- **Repo:** github.com/socioboard/Socioboard-5.0
- **Stars:** 1.4k | **Contributors:** 18 | **License:** Unclear
- **Last release:** Nov 2019 (v4.1.0) — **EFFECTIVELY DEAD**
- **Stack:** Node.js/Express + PHP frontend, MongoDB + Sequelize
- **Docker:** Partial (docker configs present)
- **Status:** No meaningful updates in 4+ years. Not viable.

### Shoutify
- **Repo:** github.com/TechSquidTV/Shoutify
- **Stars:** 403 | **License:** Apache 2.0
- **Status:** ARCHIVED May 2023, never reached functional state. Not viable.

## Comparison Matrix

| Criterion | Postiz | Mixpost (Lite) | Socioboard | Shoutify |
|-----------|--------|----------------|------------|----------|
| Activity | Active (Mar 2026) | Active (Feb 2026) | Dead (2019) | Archived |
| Stars | 27.2k | 3k | 1.4k | 403 |
| License | AGPL-3.0 | MIT (Lite only) | Unclear | Apache 2.0 |
| Language | TypeScript | PHP/Vue | Node+PHP | TypeScript |
| DB | PostgreSQL | MySQL/PostgreSQL | MongoDB | PostgreSQL |
| Platforms | 19+ all open | 3 free / 11 paid | Unknown | 1 (Twitter) |
| AI features | Yes (built-in) | Basic | No | No |
| Docker | Yes | Yes | Partial | No |
| Extension model | Excellent (NestJS DI, provider pattern) | Laravel packages | Poor | N/A |
| Multi-workspace | Yes | Yes (Pro) | Yes | No |
| Scheduling | Full | Full | Basic | None |
| Media library | Yes + design tool | Yes | Basic | No |
| Analytics | Yes | Yes (Pro) | Basic | No |
| API | Yes (REST + webhooks) | Yes | Unknown | No |
| Customisability | HIGH (TypeScript monorepo, clean patterns) | MEDIUM (PHP, Pro features locked) | LOW | N/A |

## Recommended Base Project: Postiz

**Postiz is the clear winner.** Justification:

1. **All 8+ target platforms supported in the open-source version** — Mixpost Lite only has 3
2. **TypeScript throughout** — AI integrations, custom workers, and extensions share the same language and type system
3. **Clean extension architecture** — SocialAbstract provider pattern, NestJS dependency injection, decorator system for automation
4. **PostgreSQL + Prisma** — clean schema, easy to extend with migrations
5. **Already has AI** — built-in content assistant provides foundation to extend
6. **Active community** — 27k stars, 70 contributors, releases in March 2026
7. **Docker deployment** — ready for VPS self-hosting
8. **BullMQ/Temporal for jobs** — robust queue system for scheduling/publishing

**Trade-offs:**
- AGPL-3.0 license (copyleft, but fine for self-hosted personal use)
- Organization/workspace model needs extension to full Company → Brand → Account hierarchy
- AI confidence gating not built-in (must add)
- Multi-language pipeline not built-in (must add)

## Additional Stack for Custom Layers

| Technology | Version | Purpose |
|------------|---------|---------|
| FFmpeg | 6.x | Video clipping, subtitle burning, format conversion |
| Whisper (OpenAI API or local) | latest | Audio transcription for subtitles |
| Sharp | 0.33+ | Image processing (already in Postiz) |
| MinIO | latest | S3-compatible self-hosted media storage |
| OpenAI SDK | 4.x | GPT-4o/4o-mini for content generation + vision |
| Anthropic SDK | latest | Claude for long-form generation + vision |
| Ollama | latest | Local LLM fallback |
| BullMQ | 5.x | Job queues (already in Postiz) |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Mixpost Lite | Only 3 platforms free; full support requires paid Pro license | Postiz (all platforms open) |
| Socioboard | Dead project, last release 2019 | Postiz |
| Shoutify | Archived, never functional | Postiz |
| Building from scratch | 6-12 months of reinventing what Postiz already provides | Fork and extend Postiz |

---
*Stack research for: Self-hosted AI social media management*
*Researched: 2026-03-10*
