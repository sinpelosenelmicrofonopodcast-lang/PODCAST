import { CANONICAL_SITE_URL, PUBLIC_CORE_PAGES, SITE_NAME, canonicalUrl } from "@/lib/seo/constants";
import { getPublishedEpisodes, getPublishedEvents } from "@/lib/seo/content";
import { supabaseServer } from "@/lib/supabaseServer";

type SitemapEntry = { loc: string; lastmod?: string | null };
type NewsRow = {
  id: string;
  slug?: string | null;
  title: string;
  published_at: string | null;
  updated_at?: string | null;
};
type BlogRow = {
  id: string;
  slug?: string | null;
  created_at: string | null;
  updated_at?: string | null;
};

function xmlEscape(value: string) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function toIso(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function publicSlug(value?: string | null, fallback?: string) {
  return String(value || fallback || "").trim();
}
function uniqueByUrl<T extends { loc: string }>(entries: T[]): T[] {
  return Array.from(new Map(entries.filter(entry => entry.loc).map(entry => [entry.loc, entry])).values());
}
function isPublishedYet(value?: string | null) {
  if (!value) return true;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time <= Date.now();
}
function articlePath(section: "noticias" | "blog" | "podcast" | "eventos", slug: string) {
  return canonicalUrl(`/${section}/${encodeURIComponent(slug)}`);
}

export function renderSitemapXml(entries: SitemapEntry[]) {
  const items = uniqueByUrl(entries).map(entry => `<url><loc>${xmlEscape(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : ""}</url>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}
export function renderSitemapIndexXml(paths: string[]) {
  const items = Array.from(new Set(paths)).map(path => `<sitemap><loc>${xmlEscape(canonicalUrl(path))}</loc></sitemap>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}
export function renderNewsSitemapXml(entries: Array<{ url: string; title: string; publishedAt: string }>) {
  const items = Array.from(new Map(entries.map(entry => [entry.url, entry])).values()).map(entry => {
    const publicationDate = toIso(entry.publishedAt);
    if (!publicationDate) return "";
    return `<url><loc>${xmlEscape(entry.url)}</loc><news:news><news:publication><news:name>${xmlEscape(SITE_NAME)}</news:name><news:language>es</news:language></news:publication><news:publication_date>${xmlEscape(publicationDate)}</news:publication_date><news:title>${xmlEscape(entry.title)}</news:title></news:news></url>`;
  }).filter(Boolean).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${items}</urlset>`;
}

// Use the same published news_items collection as /noticias/[id].
// Pagination prevents silently dropping older stories after the first 500.
async function loadPublishedNewsRows(): Promise<NewsRow[]> {
  const client = supabaseServer();
  const pageSize = 1000;
  const all: NewsRow[] = [];
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await client.from("news_items")
      .select("id, slug, title, published_at, updated_at")
      .eq("publication_state", "published")
      .order("published_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Failed to read news sitemap: ${error.message}`);
    const rows = (data ?? []) as NewsRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all.filter(row => isPublishedYet(row.published_at));
}

export async function postsSitemapEntries() {
  const rows = await loadPublishedNewsRows();
  return uniqueByUrl(rows.map(row => ({
    loc: articlePath("noticias", publicSlug(row.slug, row.id)),
    lastmod: toIso(row.updated_at || row.published_at)
  })));
}

export async function blogSitemapEntries() {
  const client = supabaseServer();
  const pageSize = 1000;
  const rows: BlogRow[] = [];
  for (let offset = 0; offset < 50000; offset += pageSize) {
    const { data, error } = await client.from("blog_posts")
      .select("id, slug, created_at, updated_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`Failed to read blog sitemap: ${error.message}`);
    const batch = (data ?? []) as BlogRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return uniqueByUrl(rows.filter(row => isPublishedYet(row.created_at)).map(row => ({
    loc: articlePath("blog", publicSlug(row.slug, row.id)),
    lastmod: toIso(row.updated_at || row.created_at)
  })));
}

export async function episodesSitemapEntries() {
  // This reads the stored episode archive; it does not call YouTube's API.
  const episodes = await getPublishedEpisodes(1200);
  return uniqueByUrl(episodes.filter(row => isPublishedYet(row.published_at)).map(row => ({
    loc: articlePath("podcast", publicSlug(row.slug, row.id)),
    lastmod: toIso(row.updated_at || row.published_at)
  })));
}

export async function eventsSitemapEntries() {
  const events = await getPublishedEvents(500);
  return uniqueByUrl(events.map(row => ({
    loc: articlePath("eventos", publicSlug(row.slug, row.id)),
    lastmod: toIso(row.updated_at || row.start_datetime)
  })));
}

export function pagesSitemapEntries() {
  return PUBLIC_CORE_PAGES.map(path => ({ loc: canonicalUrl(path) }));
}

export async function newsSitemapEntries() {
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  const rows = await loadPublishedNewsRows();
  return rows.filter(row => {
    const time = new Date(row.published_at || "").getTime();
    return Number.isFinite(time) && time >= cutoff;
  }).map(row => ({
    url: articlePath("noticias", publicSlug(row.slug, row.id)),
    title: row.title,
    publishedAt: String(row.published_at)
  }));
}

export const SEO_SITEMAP_INDEX_PATHS = [
  "/sitemaps/pages.xml",
  "/sitemaps/episodes.xml",
  "/sitemaps/blog.xml",
  "/sitemaps/posts.xml",
  "/sitemaps/events.xml",
  "/sitemaps/news.xml"
];

export function canonicalSitemapUrl(path: string) {
  return `${CANONICAL_SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
