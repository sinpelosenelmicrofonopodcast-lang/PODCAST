export type NewsSourceType = "rss" | "api" | "trend" | "manual" | "google_news" | "reddit";

export type NewsArticleStatus =
  | "draft"
  | "pending_review"
  | "scheduled"
  | "published"
  | "rejected"
  | "archived";

export type NewsSourceRow = {
  id: string;
  name: string;
  type: NewsSourceType;
  rss_url: string | null;
  api_url: string | null;
  category: string | null;
  region: string | null;
  active: boolean | null;
  is_active?: boolean | null;
  priority: number | null;
  meta: Record<string, unknown> | null;
  default_categories?: string[] | null;
  auto_publish?: boolean | null;
  auto_post_facebook?: boolean | null;
  max_items_per_run?: number | null;
  trust_score?: number | null;
  last_checked_at?: string | null;
  last_scanned_at?: string | null;
  scan_every_min?: number | null;
};

export type NewsArticleRow = {
  id: string;
  source_id: string | null;
  legacy_news_item_id?: string | null;
  source_name?: string | null;
  title: string;
  slug: string;
  source_url: string | null;
  original_title: string | null;
  original_content: string | null;
  rewritten_content: string | null;
  analysis?: string | null;
  summary: string | null;
  excerpt: string | null;
  author_name: string | null;
  category: string | null;
  region: string | null;
  tags: string[] | null;
  hashtags?: string[] | null;
  featured_image_url: string | null;
  cover_image_url: string | null;
  meme_image_url: string | null;
  quote_card_url: string | null;
  reel_video_url: string | null;
  reel_script: string | null;
  status: NewsArticleStatus;
  publish_at: string | null;
  published_at: string | null;
  trending_score: number;
  discover_score: number;
  controversy_score: number;
  engagement_score: number;
  impact_score?: number;
  ai_metadata: Record<string, unknown> | null;
  seo: Record<string, unknown> | null;
  social: Record<string, unknown> | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IngestedCandidate = {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  title: string;
  summary: string;
  content: string;
  publishedAt: string | null;
  region: string | null;
  category: string | null;
  tags: string[];
  featuredImageUrl: string | null;
  trustScore: number;
  priority: number;
  hash: string;
  sourceType?: NewsSourceType;
  categories?: string[];
  hashtags?: string[];
  analysis?: string | null;
  impactScore?: number;
  viralScore?: number;
  estimatedEngagement?: number;
  trendMatches?: string[];
  impactReasons?: string[];
  sourceMeta?: Record<string, unknown>;
};

export type TrendSnapshot = {
  source: string;
  keyword: string;
  region: string | null;
  score: number;
  meta?: Record<string, unknown>;
};

export type IngestSummary = {
  sources: number;
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
  mirroredToLegacy: number;
  errors: Array<{ source: string; message: string }>;
};

export type SocialPlatform = "facebook" | "instagram" | "x" | "tiktok";

export type SocialQueueItem = {
  articleId: string;
  platform: SocialPlatform;
  message: string;
  link: string;
  imageUrl?: string | null;
  scheduleAt?: string | null;
};
