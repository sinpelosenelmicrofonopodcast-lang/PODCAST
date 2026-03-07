import { CANONICAL_SITE_URL, PUBLIC_CORE_PAGES, canonicalUrl } from "@/lib/seo/constants";
import { getPublishedEpisodes, getPublishedEvents, getPublishedPosts } from "@/lib/seo/content";

type SitemapEntry = {
  loc: string;
  lastmod?: string | null;
  changefreq?: string;
  priority?: string;
};

function xmlEscape(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toIso(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

export function renderSitemapXml(entries: SitemapEntry[]) {
  const items = entries
    .map((entry) => {
      const fields = [
        `<loc>${xmlEscape(entry.loc)}</loc>`,
        entry.lastmod ? `<lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : "",
        entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : "",
        entry.priority ? `<priority>${entry.priority}</priority>` : ""
      ]
        .filter(Boolean)
        .join("");
      return `<url>${fields}</url>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</urlset>`;
}

export function renderSitemapIndexXml(paths: string[]) {
  const items = paths
    .map((path) => `<sitemap><loc>${xmlEscape(canonicalUrl(path))}</loc></sitemap>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</sitemapindex>`;
}

export function renderNewsSitemapXml(entries: Array<{ url: string; title: string; publishedAt: string }>) {
  const items = entries
    .map((entry) => {
      const publicationDate = toIso(entry.publishedAt);
      if (!publicationDate) return "";
      return `<url>` +
        `<loc>${xmlEscape(entry.url)}</loc>` +
        `<news:news xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">` +
        `<news:publication><news:name>SPM News</news:name><news:language>es</news:language></news:publication>` +
        `<news:publication_date>${xmlEscape(publicationDate)}</news:publication_date>` +
        `<news:title>${xmlEscape(entry.title)}</news:title>` +
        `</news:news>` +
        `</url>`;
    })
    .filter(Boolean)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${items}</urlset>`;
}

export async function postsSitemapEntries() {
  const posts = await getPublishedPosts(10000);
  return posts.map((post) => ({
    loc: canonicalUrl(`/noticias/${encodeURIComponent(post.slug)}`),
    lastmod: toIso(post.updated_at || post.published_at),
    changefreq: "hourly",
    priority: "0.85"
  }));
}

export async function episodesSitemapEntries() {
  const episodes = await getPublishedEpisodes(10000);
  return episodes.map((episode) => ({
    loc: canonicalUrl(`/podcast/${encodeURIComponent(episode.slug)}`),
    lastmod: toIso(episode.updated_at || episode.published_at),
    changefreq: "daily",
    priority: "0.8"
  }));
}

export async function eventsSitemapEntries() {
  const events = await getPublishedEvents(10000);
  return events.map((event) => ({
    loc: canonicalUrl(`/eventos/${encodeURIComponent(event.slug)}`),
    lastmod: toIso(event.updated_at || event.start_datetime),
    changefreq: "daily",
    priority: "0.75"
  }));
}

export function pagesSitemapEntries() {
  return PUBLIC_CORE_PAGES.map((path) => ({
    loc: canonicalUrl(path),
    changefreq: path === "/" ? "hourly" : "daily",
    priority: path === "/" ? "1.0" : "0.7"
  }));
}

export async function newsSitemapEntries() {
  const posts = await getPublishedPosts(10000);
  const cutoff = Date.now() - 48 * 60 * 60 * 1000;
  return posts
    .filter((post) => post.is_news === true && post.published_at && new Date(post.published_at).getTime() >= cutoff)
    .map((post) => ({
      url: canonicalUrl(`/noticias/${encodeURIComponent(post.slug)}`),
      title: post.title,
      publishedAt: String(post.published_at)
    }));
}

export const SEO_SITEMAP_INDEX_PATHS = [
  "/sitemaps/posts.xml",
  "/sitemaps/episodes.xml",
  "/sitemaps/events.xml",
  "/sitemaps/pages.xml",
  "/sitemaps/news.xml"
];

export function canonicalSitemapUrl(path: string) {
  return `${CANONICAL_SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

