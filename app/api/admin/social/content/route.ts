import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getYouTubeVideoId } from "@/lib/youtube";

type SearchType = "all" | "news" | "blog" | "episode";

type SearchItem = {
  id: string;
  type: "news" | "blog" | "episode";
  slug: string | null;
  title: string;
  text: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  publishedAt: string | null;
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function includesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) return true;
  const haystack = values.map((value) => normalizeText(value).toLowerCase()).join(" ");
  return haystack.includes(query);
}

function isSearchType(value: string): value is SearchType {
  return value === "all" || value === "news" || value === "blog" || value === "episode";
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, ["manage_news", "manage_blog", "view_schedule"]);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const query = normalizeText(request.nextUrl.searchParams.get("q")).toLowerCase();
    const typeParam = normalizeText(request.nextUrl.searchParams.get("type")).toLowerCase();
    const type: SearchType = isSearchType(typeParam) ? typeParam : "all";
    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "12");
    const limit = Number.isFinite(limitRaw) ? Math.min(24, Math.max(1, Math.floor(limitRaw))) : 12;

    const items: SearchItem[] = [];

    if (type === "all" || type === "news") {
      const newsRes = await auth.service
        .from("news_items")
        .select("id, slug, title, summary, cover_url, published_at, publication_state")
        .order("published_at", { ascending: false })
        .limit(80);

      if (newsRes.error) return NextResponse.json({ ok: false, error: newsRes.error.message }, { status: 400 });

      for (const row of (newsRes.data ?? []) as Array<any>) {
        if ((row.publication_state ?? "published") === "draft") continue;
        if (!includesQuery([row.title, row.summary, row.slug], query)) continue;
        items.push({
          id: String(row.id),
          type: "news",
          slug: normalizeText(row.slug) || null,
          title: normalizeText(row.title) || "Noticia",
          text: normalizeText(row.summary) || null,
          imageUrl: normalizeText(row.cover_url) || null,
          linkUrl: null,
          publishedAt: row.published_at ?? null
        });
        if (items.filter((item) => item.type === "news").length >= limit) break;
      }
    }

    if (type === "all" || type === "blog") {
      const blogRes = await auth.service
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_url, created_at")
        .order("created_at", { ascending: false })
        .limit(80);

      if (blogRes.error) return NextResponse.json({ ok: false, error: blogRes.error.message }, { status: 400 });

      for (const row of (blogRes.data ?? []) as Array<any>) {
        if (!includesQuery([row.title, row.excerpt, row.slug], query)) continue;
        items.push({
          id: String(row.id),
          type: "blog",
          slug: normalizeText(row.slug) || null,
          title: normalizeText(row.title) || "Blog",
          text: normalizeText(row.excerpt) || null,
          imageUrl: normalizeText(row.cover_url) || null,
          linkUrl: null,
          publishedAt: row.created_at ?? null
        });
        if (items.filter((item) => item.type === "blog").length >= limit) break;
      }
    }

    if (type === "all" || type === "episode") {
      const episodesRes = await auth.service
        .from("external_posts")
        .select("id, title, caption, source_url, media_url, posted_at, metrics")
        .not("source_url", "is", null)
        .order("posted_at", { ascending: false })
        .limit(140);

      if (episodesRes.error) return NextResponse.json({ ok: false, error: episodesRes.error.message }, { status: 400 });

      const seenVideoIds = new Set<string>();
      let added = 0;
      for (const row of (episodesRes.data ?? []) as Array<any>) {
        const sourceUrl = normalizeText(row.source_url);
        const videoId = getYouTubeVideoId(sourceUrl);
        if (!videoId || seenVideoIds.has(videoId)) continue;
        if (normalizeText(row.title).toLowerCase() === "auto post") continue;
        if (sourceUrl.toLowerCase().includes("/shorts/")) continue;
        const duration = Number(row?.metrics?.durationSeconds ?? 0);
        if (row?.metrics?.isShort === true) continue;
        if (Number.isFinite(duration) && duration > 0 && duration <= 180) continue;
        if (!includesQuery([row.title, row.caption, sourceUrl], query)) continue;

        seenVideoIds.add(videoId);
        items.push({
          id: String(row.id),
          type: "episode",
          slug: videoId,
          title: normalizeText(row.title) || "Episodio",
          text: normalizeText(row.caption) || null,
          imageUrl: normalizeText(row.media_url) || null,
          linkUrl: sourceUrl || null,
          publishedAt: row.posted_at ?? null
        });
        added += 1;
        if (added >= limit) break;
      }
    }

    const sorted = items
      .sort((a, b) => {
        const at = new Date(a.publishedAt ?? 0).getTime();
        const bt = new Date(b.publishedAt ?? 0).getTime();
        return bt - at;
      })
      .slice(0, type === "all" ? limit * 3 : limit);

    return NextResponse.json({ ok: true, items: sorted, query, type });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
