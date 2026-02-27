import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { newsHref } from "@/lib/newsRoute";

export const revalidate = 600;

type NewsRow = {
  id: string;
  slug?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
};

type BlogRow = {
  id: string;
  slug?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sinpelosenelmicrofono.com").replace(/\/+$/, "");

const staticPaths = [
  "/",
  "/feed",
  "/noticias",
  "/blog",
  "/community",
  "/foro",
  "/confesionario",
  "/teorias",
  "/zona-cruda",
  "/publicidad",
  "/eventos",
  "/musica",
  "/emprendimiento",
  "/podcast",
  "/rss.xml",
  "/terminos",
  "/tema/pr",
  "/tema/tx",
  "/tema/usa",
  "/tema/mundo",
  "/tema/medios",
  "/tema/economia",
  "/tema/salud",
  "/tema/tecnologia",
  "/tema/cultura",
  "/tema/politica",
  "/tema/deporte",
  "/tema/entretenimiento",
  "/tema/musica",
  "/tema/emprendimiento"
];

function blogHref(input: Pick<BlogRow, "id" | "slug">) {
  const slug = String(input.slug ?? "").trim();
  return `/blog/${encodeURIComponent(slug || input.id)}`;
}

function toAbsoluteUrl(path: string) {
  return `${siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const rows: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: toAbsoluteUrl(path),
    changeFrequency: path === "/" ? "hourly" : "daily",
    priority: path === "/" ? 1 : 0.7
  }));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) return rows;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false } });

  let newsRows: NewsRow[] = [];
  {
    const primary = await supabase
      .from("news_items")
      .select("id, slug, published_at, updated_at")
      .eq("publication_state", "published")
      .order("published_at", { ascending: false })
      .limit(5000);
    if (!primary.error) {
      newsRows = (primary.data ?? []) as NewsRow[];
    } else if (/publication_state|slug|updated_at/i.test(primary.error.message)) {
      const fallback = await supabase
        .from("news_items")
        .select("id, slug, published_at")
        .order("published_at", { ascending: false })
        .limit(5000);
      newsRows = (fallback.data ?? []) as NewsRow[];
    }
  }

  for (const item of newsRows) {
    const href = newsHref({ id: item.id, slug: item.slug ?? null });
    rows.push({
      url: toAbsoluteUrl(href),
      lastModified: item.updated_at ?? item.published_at ?? undefined,
      changeFrequency: "hourly",
      priority: 0.85
    });
  }

  let blogRows: BlogRow[] = [];
  {
    const primary = await supabase
      .from("blog_posts")
      .select("id, slug, created_at, updated_at")
      .order("created_at", { ascending: false })
      .limit(5000);
    if (!primary.error) {
      blogRows = (primary.data ?? []) as BlogRow[];
    } else if (/slug|updated_at/i.test(primary.error.message)) {
      const fallback = await supabase
        .from("blog_posts")
        .select("id, slug, created_at")
        .order("created_at", { ascending: false })
        .limit(5000);
      blogRows = (fallback.data ?? []) as BlogRow[];
    }
  }

  for (const item of blogRows) {
    rows.push({
      url: toAbsoluteUrl(blogHref(item)),
      lastModified: item.updated_at ?? item.created_at ?? undefined,
      changeFrequency: "weekly",
      priority: 0.75
    });
  }

  return rows;
}

