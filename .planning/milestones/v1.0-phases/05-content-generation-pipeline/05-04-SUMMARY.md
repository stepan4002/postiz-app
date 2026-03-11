---
phase: 05-content-generation-pipeline
plan: "04"
subsystem: frontend-content-generation
tags: [frontend, react, swr, content-generation, ui-components]
dependency_graph:
  requires: [05-03]
  provides: [content-generation-ui, create-post-form, media-picker-dual-mode]
  affects: [06-scheduling-publishing-engine]
tech_stack:
  added: []
  patterns:
    - SWR mutation hook with useState for loading/error (useGeneratePost)
    - SWR query hook per CLAUDE.md one-hook-per-file rule (useBrands)
    - Dual-mode media picker (library grid + inline upload)
    - import.meta cast via `any` for Vite env in Next.js-typed tsconfig
key_files:
  created:
    - apps/frontend/src/components/content-generation/hooks/use-brands.ts
    - apps/frontend/src/components/content-generation/hooks/use-generate-post.ts
    - apps/frontend/src/components/content-generation/platform-selector.tsx
    - apps/frontend/src/components/content-generation/content-type-selector.tsx
    - apps/frontend/src/components/content-generation/media-picker.tsx
    - apps/frontend/src/components/content-generation/generation-result.tsx
    - apps/frontend/src/components/content-generation/create-post-form.tsx
  modified: []
decisions:
  - "import.meta cast via `any` for VITE_MINIO_PUBLIC_URL: tsconfig types=[\"node\"] doesn't include Vite ImportMeta; cast (import.meta as any)?.env?.VITE_MINIO_PUBLIC_URL avoids error while preserving runtime behavior"
  - "GenerateResult defined in use-generate-post.ts and re-exported; GenerationResult component imports type from hook file"
metrics:
  duration: 5min
  completed_date: "2026-03-10"
  tasks: 2
  files: 7
---

# Phase 05 Plan 04: Content Generation UI Summary

One-liner: React content generation form with dual-mode media picker (library + inline upload), SWR hooks, and per-platform caption result display.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | SWR hooks for brand list and post generation | b6e73366 |
| 2 | Content generation form UI components with inline media upload | c1a8e604 |

## What Was Built

### Task 1: SWR Hooks

**`use-brands.ts`** — SWR query hook for `GET /companies/:slug/brands`:
- Returns `Brand[]` (id, name, slug, logo?)
- SWR key: `brands-${companySlug}` (null when no slug)
- Uses `useFetch` per CLAUDE.md pattern
- One hook per file, CLAUDE.md compliant

**`use-generate-post.ts`** — Mutation hook for `POST /companies/:slug/posts/generate`:
- Returns `{ generate, isLoading, error }` (not SWR — this is a mutation)
- Internal `useState` for loading/error lifecycle
- `generate(dto: CreatePostInput)` returns `Promise<GenerateResult>`
- `useCallback` for stable reference

### Task 2: UI Components

**`platform-selector.tsx`** — Multi-select toggle buttons:
- 4 platforms: Instagram, Facebook, LinkedIn, X
- Toggle logic: click to add/remove from selected array
- Selected: `bg-btnPrimary text-white`; unselected: `bg-btnSimple text-textItemBlur`

**`content-type-selector.tsx`** — `<select>` dropdown:
- 7 content types: product, brand_story, educational, seasonal, offer, testimonial, behind_the_scenes
- Styled with project design tokens

**`media-picker.tsx`** — Dual-mode media selection:
- MODE 1 (library): uses `useCompanyMedia` hook, 3-col grid, click-to-select, pagination prev/next
- MODE 2 (inline upload): hidden file input triggered by button, calls `useMediaUpload().uploadMedia()`, shows progress bar, auto-selects on upload complete, mutates SWR to refresh grid
- "No media" option for text-only posts
- `resolveMediaUrl` follows `media-grid.tsx` pattern using `(import.meta as any)?.env?.VITE_MINIO_PUBLIC_URL`

**`generation-result.tsx`** — Results display:
- Loading state: spinner + 3 skeleton cards
- Per-variant cards with: platform badge (color-coded), status badge, confidence badge (green >0.7, yellow 0.5-0.7, red <0.5), caption text (scrollable), hashtag chips

**`create-post-form.tsx`** — Main form orchestrator:
- Gets `companySlug` from `useCompany()` context
- Brand selector from `useBrands`
- Composes: MediaPicker, ContentTypeSelector, brief textarea, PlatformSelector
- Generate button disabled when no brand or no platforms selected
- Inline error handling, loading state in button

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `import.meta.env` TypeScript error in media-picker.tsx**
- **Found during:** Task 2 verification (TypeScript compilation)
- **Issue:** `tsconfig.json` has `types: ["node"]` which doesn't include Vite's `ImportMeta` type extension; `import.meta.env` caused TS2339 error
- **Fix:** Cast `(import.meta as any)?.env?.VITE_MINIO_PUBLIC_URL` — preserves the plan's intent (Vite env var at runtime) while satisfying TypeScript
- **Files modified:** `apps/frontend/src/components/content-generation/media-picker.tsx`
- **Commit:** c1a8e604 (included in Task 2 commit)

## Self-Check: PASSED

All 7 files exist on disk. Both commits (b6e73366, c1a8e604) confirmed in git log.
