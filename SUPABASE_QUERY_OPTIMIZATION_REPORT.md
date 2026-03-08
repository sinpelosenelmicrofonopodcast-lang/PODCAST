# Supabase Query Optimization Report
Date: 2026-03-08

## Query-Level Changes Implemented
## 1) `/api/feed` projection reduction
- Before: selected full `news_articles` row (including large content and metadata fields).
- After: selects only fields needed for ranking and feed card payload.
- Benefit: lower DB I/O, lower response payload, lower JSON serialization cost.

## 2) Homepage trending engagement path
- `page_visits` projection reduced from `path, visited_at` to `path` (only used value).
- Scan cap reduced from `50000` to `20000` in engagement aggregation helper.

## 3) Pageview insert hot path
- Removed `supabase.auth.getUser()` call from pageview API.
- Keeps analytics write lightweight for anonymous traffic.

## 4) Supabase client reuse
- Added singleton reuse for service/server clients to avoid repeated client construction overhead in hot code paths.

## Index Migration Added
- `supabase/migrations/20260308013000_performance_optimization.sql`

## Index Intent by Workload
- Latest/published news lists: composite indexes on publication state + date.
- Feed/trending ranking: composite indexes on `news_articles` (`status`, `published_at`, `trending_score`, `region`).
- Comment ranking: composite indexes on legacy comments by `(content_type, content_id)`.
- Scheduler/cron: partial indexes for queued/publishing `scheduled_posts`.
- Automation runner: queue execution ordering index.
- Visits analytics: pattern + time index for `/noticias/%` scans.

## Validation
- Application build passed after query and index changes.
- No API routes were removed.
