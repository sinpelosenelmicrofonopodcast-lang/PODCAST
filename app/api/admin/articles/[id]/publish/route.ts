import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { publishArticle } from "@/lib/news/editorial";
import { sendArticlePush } from "@/lib/social/push";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const pushNow = body?.pushNow === true;
    const result = await publishArticle(auth.service, String(params.id ?? "").trim(), auth.userId, pushNow);

    if (pushNow) {
      const article = await auth.service
        .from("news_articles")
        .select("slug, title, summary, cover_image_url, category")
        .eq("id", String(params.id ?? "").trim())
        .limit(1)
        .maybeSingle();

      if (!article.error && article.data?.slug) {
        await sendArticlePush({
          title: String(article.data.title ?? "Última hora"),
          message: String(article.data.summary ?? "Nueva noticia publicada."),
          url: `/noticias/${encodeURIComponent(String(article.data.slug))}`,
          imageUrl: (article.data as any).cover_image_url ?? null,
          category: (article.data as any).category ?? "noticias"
        }).catch(() => null);
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 400 });
  }
}
