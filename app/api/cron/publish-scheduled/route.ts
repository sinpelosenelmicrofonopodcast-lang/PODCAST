import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { isCronAuthorized } from "@/lib/jobs/cronAuth";
import { publishArticle } from "@/lib/news/editorial";
import { sendArticlePush } from "@/lib/social/push";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  try {
    const service = supabaseService();
    const now = new Date().toISOString();

    const { data, error } = await service
      .from("news_articles")
      .select("id, slug, title, summary, cover_image_url, category")
      .eq("status", "scheduled")
      .lte("publish_at", now)
      .order("publish_at", { ascending: true })
      .limit(30);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    let published = 0;
    let pushSent = 0;
    let failed = 0;

    for (const row of data ?? []) {
      try {
        await publishArticle(service, (row as any).id, null, true);
        published += 1;

        const autoPush = String(process.env.AUTO_PUSH_ENABLED ?? "true").toLowerCase() !== "false";
        if (autoPush) {
          await sendArticlePush({
            title: String((row as any).title ?? "Última hora"),
            message: String((row as any).summary ?? "Nueva noticia publicada."),
            url: `/noticias/${encodeURIComponent(String((row as any).slug ?? (row as any).id))}`,
            imageUrl: (row as any).cover_image_url ?? null,
            category: (row as any).category ?? "noticias"
          }).catch(() => null);
          pushSent += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      scanned: (data ?? []).length,
      published,
      pushSent,
      failed
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = POST;
