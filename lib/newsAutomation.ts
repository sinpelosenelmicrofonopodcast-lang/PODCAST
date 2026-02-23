import { contentHash, normalizeSourceUrl } from "@/lib/pipelineOps";

export type NewsSource = {
  id: string;
  name: string;
  rss_url: string;
  region: string | null;
  default_categories: string[] | null;
  auto_publish: boolean | null;
  auto_post_facebook: boolean | null;
  max_items_per_run: number | null;
};

export type FeedItem = {
  title: string;
  link: string;
  description: string;
  publishedAt: string | null;
};

function decodeHtml(input: string) {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(input: string) {
  return decodeHtml(String(input ?? ""))
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function take(tag: string, block: string) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  return m?.[1] ? decodeHtml(m[1]).trim() : "";
}

function safeIsoDate(value?: string | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function parseRssItems(xml: string): FeedItem[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((item) => {
      const title = stripHtml(take("title", item));
      const link = normalizeSourceUrl(take("link", item)) ?? "";
      const description = stripHtml(take("description", item) || take("content:encoded", item));
      const pubRaw = take("pubDate", item);
      const publishedAt = safeIsoDate(pubRaw);
      return { title, link, description, publishedAt };
    })
    .filter((i) => i.title && i.link);
}

function parseAtomItems(xml: string): FeedItem[] {
  const entries = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  return entries
    .map((entry) => {
      const title = stripHtml(take("title", entry));
      const linkMatch = entry.match(/<link[^>]*href="([^"]+)"[^>]*>/i);
      const link = normalizeSourceUrl(linkMatch?.[1] ?? "") ?? "";
      const summary = take("summary", entry) || take("content", entry);
      const description = stripHtml(summary);
      const pubRaw = take("updated", entry) || take("published", entry);
      const publishedAt = safeIsoDate(pubRaw);
      return { title, link, description, publishedAt };
    })
    .filter((i) => i.title && i.link);
}

export function parseFeedXml(xml: string): FeedItem[] {
  if (!xml) return [];
  const source = xml.toLowerCase();
  if (source.includes("<rss") || source.includes("<item")) return parseRssItems(xml);
  if (source.includes("<feed") || source.includes("<entry")) return parseAtomItems(xml);
  return [];
}

export function summarizeDescription(text: string) {
  const clean = stripHtml(text);
  if (!clean) return "";
  if (clean.length <= 260) return clean;
  return `${clean.slice(0, 257).trim()}...`;
}

const keywordCategories: Array<{ words: string[]; cat: string }> = [
  { words: ["econom", "inflaci", "mercado", "negocio", "finanza"], cat: "Economía" },
  { words: ["salud", "hospital", "medicina", "virus"], cat: "Salud" },
  { words: ["tecnolog", "startup", "ai", "inteligencia artificial"], cat: "Tecnología" },
  { words: ["deporte", "nba", "nfl", "mlb", "futbol", "béisbol"], cat: "Deporte" },
  { words: ["entreten", "musica", "cine", "artista"], cat: "Entretenimiento" },
  { words: ["gobierno", "eleccion", "senado", "congreso", "ley", "polit"], cat: "Política" },
  { words: ["medios", "prensa", "periodismo"], cat: "Medios" },
  { words: ["cultura", "identidad"], cat: "Cultura" }
];

export function inferCategories(input: {
  region?: string | null;
  title: string;
  description: string;
  defaults?: string[] | null;
}) {
  const out = new Set<string>();
  const region = String(input.region ?? "").trim();
  if (region) out.add(region);
  (input.defaults ?? []).forEach((c) => c && out.add(c));

  const hay = `${input.title} ${input.description}`.toLowerCase();
  for (const rule of keywordCategories) {
    if (rule.words.some((w) => hay.includes(w.toLowerCase()))) out.add(rule.cat);
  }

  if (out.size === 0) out.add("Mundo");
  return Array.from(out).slice(0, 4);
}

export function inferTags(title: string, summary: string, categories: string[]) {
  const tokens = `${title} ${summary}`
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúñü\s-]/gi, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4);

  const tags = new Set<string>();
  categories.forEach((c) => tags.add(c.toLowerCase()));
  tokens.slice(0, 12).forEach((t) => tags.add(t));
  return Array.from(tags).slice(0, 10);
}

export function buildAutoAnalysis(input: { sourceName: string; title: string; summary: string }) {
  const lines = [
    `Resumen automático inicial para revisión editorial.`,
    `Fuente detectada: ${input.sourceName}.`,
    `Tema central: ${input.title}.`,
    input.summary ? `Contexto: ${input.summary}` : "",
    `Nota Sin Pelos: se recomienda validación humana final antes de difusión masiva en redes.`
  ].filter(Boolean);
  return lines.join("\n\n");
}

export function computeNewsAutomationHash(input: { title: string; summary: string; analysis: string; sourceUrl: string }) {
  return contentHash([normalizeSourceUrl(input.sourceUrl) ?? "", input.title, input.summary, input.analysis]);
}
