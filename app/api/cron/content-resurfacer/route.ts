import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { isCronAuthorized } from "@/lib/jobs/cronAuth";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  try {
    const service = supabaseService();
    const olderThan = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();

    const { data, error } = await service
      .from("news_articles")
      .select("id, slug, title, summary")
      .eq("status", "published")
      .lt("published_at", olderThan)
      .order("engagement_score", { ascending: false })
      .limit(10);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    for (const row of data ?? []) {
      await service.from("social_publications").insert({
        article_id: (row as any).id,
        platform: "facebook",
        status: "queued",
        payload: {
          message: `Lo que sigue dando de qué hablar: ${String((row as any).summary ?? (row as any).title)}`.slice(0, 500),
          link: `/noticias/${encodeURIComponent(String((row as any).slug ?? (row as any).id))}`
        }
      });
    }

    return NextResponse.json({ ok: true, resurfaced: (data ?? []).length });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = POST;
