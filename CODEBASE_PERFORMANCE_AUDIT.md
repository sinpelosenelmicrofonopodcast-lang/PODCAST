# Codebase Performance Audit
Date: 2026-03-08
Scope: Existing Next.js App Router codebase (`app`, `components`, `lib`, `supabase`) without breaking current product flows.

## Executive Summary
- Build/typecheck is passing after optimization pass (`pnpm build`).
- High-impact bottlenecks were concentrated in:
  - duplicated auth resolution in admin server rendering,
  - overfetching in feed APIs,
  - high-frequency analytics writes doing extra auth work,
  - excessive client surface in core layout/admin shell.
- Safe optimizations were applied without route or UI regressions.

## Findings
## 1) Server/Client boundary
- `use client` footprint is high for project size.
- Count before pass: `82` client files.
- Count after pass: `80` client files.
- Main improvement: `AdminShell` moved to server-rendered wrapper; pathname handling kept in client `Sidebar`.

## 2) Overfetch / payload bloat
- `/api/feed` selected a full `news_articles` row including large text columns (`original_content`, `rewritten_content`, metadata blobs) when ranking only required a small subset.
- Homepage trending path read `page_visits` with `path, visited_at` while only `path` was used.

## 3) High-frequency endpoint overhead
- `/api/analytics/pageview` executed `supabase.auth.getUser()` on each pageview insert.
- In current architecture, this was unnecessary for anonymous tracking and adds avoidable overhead on a hot endpoint.

## 4) Duplicate admin auth resolution
- Admin layout/page flows can resolve access repeatedly in a single render request path.
- `lib/adminAuth.ts` lacked request-scope memoization for token-to-role/permission resolution.

## 5) Supabase client instantiation churn
- New Supabase clients were created repeatedly in hot utility paths (`supabaseServer`, `supabaseService`, homepage service helper).

## 6) Memory/timer hygiene
- `OneSignalAutoPrompt` used chained timer promises without explicit timeout cleanup and with potential unhandled rejections.

## 7) Dead-code candidates (not removed this pass for safety)
- `/api/feed` appears lightly referenced internally (no direct app usage found), but kept for external/API compatibility.
- Social adapters have placeholders by design (`lib/social/x.ts`, `lib/social/tiktok.ts`).

## Changes Applied
- Converted `AdminShell` to server component and localized pathname logic to `Sidebar`.
- Added singleton reuse in:
  - `lib/supabaseServer.ts`
  - `lib/supabaseService.ts`
  - `lib/homepageQueries.ts` service client helper
- Added request-scope cached access resolution in `lib/adminAuth.ts`.
- Reduced `/api/feed` select projection to ranking/display-required fields only.
- Removed unnecessary auth call from `/api/analytics/pageview`.
- Reduced homepage engagement query payload (`page_visits` now selects `path` only; lowered scan cap).
- Added robust timer cleanup and guarded async handling in `components/OneSignalAutoPrompt.tsx`.
- Added safe middleware matcher exclusion for `_next/static`, `_next/image`, `favicon.ico`.
- Added safe performance migration with targeted indexes:
  - `supabase/migrations/20260308013000_performance_optimization.sql`.

## Safety/Compatibility Notes
- No routes removed.
- No business flow intentionally changed.
- UI behavior preserved.
- Build passed after changes.

## Remaining Risks / Follow-up
- No ESLint configuration is currently set up (`next lint` prompts interactive setup), so lint gate is not enforceable yet.
- Large admin pages are still client-heavy; additional server/component partitioning can reduce JS further.
- Several cron and admin API handlers still instantiate local clients directly; can be standardized incrementally.
