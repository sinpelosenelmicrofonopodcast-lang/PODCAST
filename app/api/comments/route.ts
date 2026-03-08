import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { getUserIdFromBearer } from "@/lib/authToken";
import { checkRateLimit } from "@/lib/validations/rateLimit";
import { asOptionalString, asString, isUuid } from "@/lib/validations/common";
import { trackArticleEvent } from "@/lib/analytics/events";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const limited = checkRateLimit(`api:comments:${ip}`, 8, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "Demasiadas acciones. Intenta en unos minutos." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const articleId = asString(body?.articleId, 80);
    const parentId = asOptionalString(body?.parentId, 80);
    const text = asString(body?.body, 2000);
    const guestName = asOptionalString(body?.guestName, 80);

    if (!isUuid(articleId)) return NextResponse.json({ ok: false, error: "articleId inválido." }, { status: 400 });
    if (!text || text.length < 2) return NextResponse.json({ ok: false, error: "Comentario muy corto." }, { status: 400 });
    if (parentId && !isUuid(parentId)) return NextResponse.json({ ok: false, error: "parentId inválido." }, { status: 400 });

    const userId = await getUserIdFromBearer(request.headers.get("authorization"));
    const service = supabaseService();

    const article = await service.from("news_articles").select("id,status").eq("id", articleId).limit(1).maybeSingle();
    if (article.error || !article.data?.id || article.data.status !== "published") {
      return NextResponse.json({ ok: false, error: "Artículo no disponible para comentarios." }, { status: 404 });
    }

    if (parentId) {
      const parent = await service
        .from("article_comments")
        .select("id,article_id,status")
        .eq("id", parentId)
        .limit(1)
        .maybeSingle();
      if (parent.error || !parent.data?.id || parent.data.article_id !== articleId) {
        return NextResponse.json({ ok: false, error: "parentId inválido para este artículo." }, { status: 400 });
      }
      if (parent.data.status === "hidden") {
        return NextResponse.json({ ok: false, error: "No se puede responder a este comentario." }, { status: 400 });
      }
    }

    const insert = await service
      .from("article_comments")
      .insert({
        article_id: articleId,
        parent_id: parentId,
        user_id: userId,
        guest_name: userId ? null : guestName || "Invitado",
        body: text,
        status: userId ? "visible" : "pending"
      })
      .select("id,article_id,parent_id,user_id,guest_name,body,status,created_at")
      .limit(1)
      .maybeSingle();

    if (insert.error || !insert.data?.id) {
      return NextResponse.json({ ok: false, error: insert.error?.message ?? "No se pudo guardar comentario." }, { status: 400 });
    }

    await trackArticleEvent(service, {
      articleId,
      eventType: parentId ? "comment_reply" : "comment_create",
      userId,
      sessionId: request.headers.get("x-session-id") ?? ip,
      referrer: request.headers.get("referer"),
      meta: { moderation_status: insert.data.status }
    }).catch(() => null);

    return NextResponse.json({ ok: true, comment: insert.data });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
