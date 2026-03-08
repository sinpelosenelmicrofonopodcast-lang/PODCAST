# Next.js Audit
Date: 2026-03-08
Framework: Next.js 14.2.5 (App Router, typed routes enabled)

## Build Status
- `pnpm build`: PASS
- Static generation and route optimization complete.

## Key Findings
## 1) Global hydration pressure
- Root layout included multiple client-only utilities globally.
- Dynamic imports were already introduced for non-critical client widgets; retained and validated.

## 2) Admin rendering strategy
- Admin shell previously relied on client-side pathname wrapper.
- Updated to server-rendered `AdminShell`, keeping only `Sidebar` as client for active route highlight.

## 3) Auth duplication in server render path
- Repeated access resolution in admin route tree was possible.
- Added request-scope memoization in `lib/adminAuth.ts` via `react` `cache`.

## 4) API payload tuning
- `/api/feed` had broad `select` projection causing unnecessary DB payload and JSON serialization.
- Projection narrowed to feed/ranking fields only.

## 5) Middleware scope
- Middleware ran for all paths; now excludes `_next/static`, `_next/image`, and `favicon.ico` at matcher level.

## Applied Next.js Optimizations
- `components/AdminShell.tsx`: converted to server component.
- `components/Sidebar.tsx`: route activity derived with `usePathname` directly.
- `lib/adminAuth.ts`: request-scope access cache.
- `app/api/feed/route.ts`: reduced row payload.
- `middleware.ts`: tighter matcher.
- `app/layout.tsx`: dynamic client utility loading preserved and validated.

## Measured/Observable Impact
- Client files count reduced (`82 -> 80` in this pass context).
- `/api/feed` transfer payload reduced materially (large text/json fields removed from list endpoint).
- Build remains stable with no route regressions.

## Remaining Next.js Opportunities
- Introduce explicit suspense boundaries for heavier admin pages.
- Incrementally convert admin pages from client-fetch-on-mount to server-first with actions where possible.
- Add production ESLint config to enforce future performance patterns.
