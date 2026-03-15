import { getYouTubeVideoId } from "@/lib/youtube";

export type ExternalPodcastPost = {
  id: string;
  platform: string;
  title: string | null;
  caption: string | null;
  source_url: string | null;
  media_url: string | null;
  posted_at: string | null;
  metrics: {
    views?: number;
    likes?: number;
    comments?: number;
    durationSeconds?: number;
    isShort?: boolean;
  } | null;
};

export type PodcastEpisodesPage = {
  items: ExternalPodcastPost[];
  nextCursor: string | null;
  hasMore: boolean;
};

const SOURCE_SCAN_LIMIT = 120;
const DEFAULT_PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 24;

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function safeNum(value: unknown) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function uniqueExternalPodcastPosts(items: ExternalPodcastPost[]) {
  const seen = new Set<string>();
  const out: ExternalPodcastPost[] = [];
  for (const item of items) {
    const key = [
      cleanText(item.platform).toLowerCase(),
      cleanText(item.source_url).toLowerCase(),
      cleanText(item.id).toLowerCase()
    ].join("|");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function isPodcastSource(post: ExternalPodcastPost) {
  const sourceUrl = cleanText(post.source_url);
  const videoId = getYouTubeVideoId(sourceUrl);
  if (!videoId) return false;

  const duration = safeNum(post.metrics?.durationSeconds);
  if (duration <= 0) return false;

  const platform = cleanText(post.platform).toLowerCase();
  if (platform.includes("youtube")) return true;

  // Fallback for older rows synced before platform normalization.
  return sourceUrl.toLowerCase().includes("youtube.com") || sourceUrl.toLowerCase().includes("youtu.be");
}

export function isShortPodcastPost(post: ExternalPodcastPost) {
  const metrics = post.metrics ?? {};
  if (metrics.isShort === true) return true;
  const duration = safeNum(metrics.durationSeconds);
  if (duration > 0 && duration <= 180) return true;
  const sourceUrl = cleanText(post.source_url).toLowerCase();
  if (sourceUrl.includes("youtube.com/shorts/")) return true;
  const text = `${post.title ?? ""} ${post.caption ?? ""}`.toLowerCase();
  if (
    text.includes("#shorts") ||
    text.includes(" #short ") ||
    text.includes("shorts ") ||
    text.includes(" reel ") ||
    text.includes(" reels ") ||
    text.includes("#reel")
  ) {
    return true;
  }
  return false;
}

function toExternalPodcastPost(row: any): ExternalPodcastPost | null {
  const id = cleanText(row?.id);
  if (!id) return null;
  return {
    id,
    platform: cleanText(row?.platform) || "YouTube",
    title: row?.title ? String(row.title) : null,
    caption: row?.caption ? String(row.caption) : null,
    source_url: row?.source_url ? String(row.source_url) : null,
    media_url: row?.media_url ? String(row.media_url) : null,
    posted_at: row?.posted_at ? String(row.posted_at) : null,
    metrics: row?.metrics ?? null
  };
}

export async function queryPodcastEpisodesPage(
  supabase: any,
  cursor?: string | null,
  limitRaw?: number
): Promise<PodcastEpisodesPage> {
  const limit = Math.max(
    6,
    Math.min(MAX_PAGE_SIZE, Math.floor(Number(limitRaw ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE))
  );
  const safeCursor = cleanText(cursor) || null;

  let query = supabase
    .from("external_posts")
    .select("id, platform, title, caption, metrics, source_url, posted_at, media_url")
    .not("source_url", "is", null)
    .not("posted_at", "is", null)
    .or("platform.ilike.%youtube%,source_url.ilike.%youtube.com%,source_url.ilike.%youtu.be%")
    .order("posted_at", { ascending: false })
    .limit(SOURCE_SCAN_LIMIT);

  if (safeCursor) {
    query = query.lt("posted_at", safeCursor);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    return { items: [], nextCursor: null, hasMore: false };
  }

  const mapped = data.map(toExternalPodcastPost).filter(Boolean) as ExternalPodcastPost[];
  const items = uniqueExternalPodcastPosts(mapped)
    .filter((post) => isPodcastSource(post) && !isShortPodcastPost(post))
    .slice(0, limit);

  const rawCursor = data.length > 0 ? cleanText((data[data.length - 1] as any)?.posted_at) : "";
  const nextCursor = rawCursor || null;
  const hasMore = Boolean(nextCursor) && data.length === SOURCE_SCAN_LIMIT;

  return { items, nextCursor, hasMore };
}
