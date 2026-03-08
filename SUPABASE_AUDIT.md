# Supabase Audit
Date: 2026-03-08
Scope: Query shape, index coverage, client usage patterns, hot endpoints.

## High-Traffic Query Findings
## 1) Feed overfetch
- `app/api/feed/route.ts` fetched full `news_articles` records, including long text/blob-like fields.
- This increased DB response size and server serialization work.
- Fixed by narrowing projection to fields needed for rank + card rendering.

## 2) Homepage engagement scan
- `lib/homepageQueries.ts` queried `page_visits` with unused `visited_at` in projection.
- Fixed by selecting only `path` and reducing maximum scan volume.

## 3) Pageview endpoint overhead
- `app/api/analytics/pageview/route.ts` called `auth.getUser()` for each event.
- For current anonymous write path, this is unnecessary.
- Fixed by removing user lookup from hot insert path.

## 4) Client creation churn
- Multiple utilities recreated Supabase clients repeatedly.
- Fixed by singleton reuse in:
  - `lib/supabaseServer.ts`
  - `lib/supabaseService.ts`
  - service helper in `lib/homepageQueries.ts`

## Index Coverage Assessment
Existing SQL already included many useful indexes (automation, viral OS, SEO, scheduled posts, page visits).
Additional composite/partial indexes were added for common access paths that were still suboptimal.

See migration:
- `supabase/migrations/20260308013000_performance_optimization.sql`

## Added Index Families
- `news_items` by state + publish date + region.
- `blog_posts` by publication state + creation date.
- `external_posts` by platform/date and date.
- `comments` by `(content_type, content_id)` and recent slices.
- `threads` by `(space, created_at desc)`.
- `promotions` active-window+ordering.
- `scheduled_posts` partial indexes for queued/publishing paths.
- `automation_jobs` queue execution ordering index.
- `page_visits` prefix-friendly pattern + time index.
- `news_articles` composite indexes for feed/trending filters.

## RLS / Security Notes
- No permissive policy expansion was introduced in this pass.
- Query optimizations were applied without relaxing auth boundaries.

## Remaining Supabase Risks
- Some admin/cron handlers still use wide selects that can be tightened further.
- Very large historical tables (`page_visits`, `external_posts`, `article_events`) should get retention/archival policy if growth accelerates.
