import fallbackSnapshot from "@/data/publishedNewsSnapshot.json";

export type PublishedNewsItem = {
  id: string;
  slug: string | null;
  title: string;
  summary: string | null;
  analysis: string | null;
  source_url: string | null;
  cover_url: string | null;
  categories: string[];
  published_at: string;
  updated_at: string | null;
  video_url: string | null;
};

const SOURCE = "https://api.github.com/repos/sinpelosenelmicrofonopodcast-lang/PODCAST/issues/20";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseFeed(input: unknown): PublishedNewsItem[] {
  if (!input || typeof input !== "object") return [];
  const payload = input as { schema?: unknown; items?: unknown };
  if (payload.schema !== "spm-public-news-v1" || !Array.isArray(payload.items)) return [];
  const now = Date.now();
  const result: PublishedNewsItem[] = [];
  const seen = new Set<string>();

  for (const value of payload.items.slice(0, 24)) {
    if (!value || typeof value !== "object") continue;
    const x = value as Record<string, unknown>;
    const id = String(x.id ?? "").trim();
    const title = String(x.title ?? "").trim();
    const body = String(x.analysis ?? "").trim();
    const stamp = Date.parse(String(x.published_at ?? ""));
    if (x.publication_state !== "published" || !UUID.test(id) || !title || !body || !Number.isFinite(stamp) || stamp > now + 600000 || seen.has(id)) continue;
    seen.add(id);
    const categories = Array.isArray(x.categories)
      ? x.categories.filter((c): c is string => typeof c === "string").map(c => c.slice(0, 70)).slice(0, 4)
      : [];
    const str = (v: unknown, limit: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, limit) : null);
    result.push({
      id,
      slug: str(x.slug, 180),
      title: title.slice(0, 240),
      summary: str(x.summary, 2000),
      analysis: body.slice(0, 16000),
      source_url: str(x.source_url, 1800),
      cover_url: str(x.cover_url, 1800),
      categories,
      published_at: new Date(stamp).toISOString(),
      updated_at: str(x.updated_at, 50),
      video_url: str(x.video_url, 1800)
    });
  }
  return result.sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

export async function loadPublishedNewsBridge(): Promise<PublishedNewsItem[]> {
  try {
    const response = await fetch(SOURCE, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "SinPelosNewsWebsite/1.0"
      },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4500)
    });
    if (response.ok) {
      const issue = (await response.json()) as { body?: unknown };
      if (typeof issue.body === "string" && issue.body.length <= 65000) {
        const live = parseFeed(JSON.parse(issue.body));
        if (live.length) return live;
      }
    }
  } catch {
    // Keep the current public news readable during a transient upstream failure.
  }
  return parseFeed(fallbackSnapshot);
}

export async function loadPublishedNewsItem(key: string): Promise<PublishedNewsItem | null> {
  const items = await loadPublishedNewsBridge();
  const candidate = decodeURIComponent(String(key ?? "")).trim();
  return items.find((x) => x.id === candidate || x.slug === candidate) ?? null;
}

/**
 * Permanent read-only archive: the live feed holds recent items, while every
 * confirmed article gets its own stable published-only record on a dedicated
 * Git branch. The branch never triggers a website build.
 */
export async function loadArchivedNewsItem(key: string): Promise<PublishedNewsItem | null> {
  if (!UUID.test(key)) return null;
  const url = "https://raw.githubusercontent.com/sinpelosenelmicrofonopodcast-lang/PODCAST/editorial-archive/data/news/" + key + ".json";
  try {
    const response = await fetch(url, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4500)
    });
    if (!response.ok) return null;
    const item = await response.json();
    return parseFeed({ schema: "spm-public-news-v1", items: [item] }).find(x => x.id === key) ?? null;
  } catch {
    return null;
  }
}
