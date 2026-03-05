import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { postNewsToInstagram } from "@/lib/socialInstagram";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

type NewsRow = {
  id: string;
  slug: string | null;
  title: string | null;
  summary: string | null;
  cover_url: string | null;
};

export async function POST(request: NextRequest) {
  let jobId = "";
  try {
    const auth = await requireStaffApi(request, "manage_news");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const body = await request.json().catch(() => ({}));
    const newsId = String(body?.newsId ?? "").trim();
    let newsSlug = String(body?.newsSlug ?? "").trim();
    let title = String(body?.title ?? "").trim();
    let summary = String(body?.summary ?? "").trim();
    let coverUrl = String(body?.coverUrl ?? "").trim();
    const publishAs = body?.story === true ? "story" : "feed";

    if (!newsId) return NextResponse.json({ ok: false, error: "newsId requerido." }, { status: 400 });

    if (!title || !summary || !coverUrl || !newsSlug) {
      const newsRes = await auth.service
        .from("news_items")
        .select("id, slug, title, summary, cover_url")
        .eq("id", newsId)
        .limit(1)
        .maybeSingle();

      if (newsRes.error) {
        return NextResponse.json({ ok: false, error: newsRes.error.message }, { status: 400 });
      }

      const row = (newsRes.data ?? null) as NewsRow | null;
      if (!row) return NextResponse.json({ ok: false, error: "Noticia no encontrada." }, { status: 404 });

      if (!newsSlug) newsSlug = String(row.slug ?? "").trim();
      if (!title) title = String(row.title ?? "").trim();
      if (!summary) summary = String(row.summary ?? "").trim();
      if (!coverUrl) coverUrl = String(row.cover_url ?? "").trim();
    }

    if (!coverUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "Instagram requiere cover_url pública (imagen accesible por URL)."
        },
        { status: 400 }
      );
    }

    jobId = await createAutomationJob(auth.service, {
      jobType: "instagram_post_news",
      source: "instagram",
      title: title || (publishAs === "story" ? "Publicar historia en Instagram" : "Publicar noticia en Instagram"),
      contentType: "news",
      contentId: newsId,
      payload: { title, summary, newsSlug: newsSlug || null, coverUrl, publishAs },
      status: "running",
      createdBy: auth.userId
    });

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "social",
      status: "info",
      contentType: "news",
      contentId: newsId,
      platform: "Instagram",
      message: publishAs === "story" ? "Inicio de publicación en historia de Instagram" : "Inicio de publicación en Instagram",
      actorId: auth.userId
    });

    const posted = await postNewsToInstagram({
      newsId,
      newsSlug: newsSlug || null,
      title,
      summary,
      coverUrl,
      publishAs
    });

    await auth.service.from("external_posts").upsert(
      {
        platform: "Instagram",
        external_id: String(posted.mediaId ?? `news-${newsId}`),
        title: title || null,
        caption: publishAs === "story" ? null : summary || null,
        media_url: coverUrl,
        metrics: null,
        posted_at: new Date().toISOString(),
        source_url: posted.articleUrl
      },
      { onConflict: "platform,external_id", ignoreDuplicates: true }
    );

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "social",
      status: "ok",
      contentType: "news",
      contentId: newsId,
      platform: "Instagram",
      message: publishAs === "story" ? "Historia publicada en Instagram" : "Noticia publicada en Instagram",
      meta: { mediaId: posted.mediaId, link: posted.articleUrl, publishAs },
      actorId: auth.userId
    });

    await updateAutomationJob(auth.service, jobId, {
      status: "done",
      attempts: 1,
      finishedAt: new Date().toISOString(),
      payload: { title, summary, coverUrl, link: posted.articleUrl, mediaId: posted.mediaId, publishAs }
    });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.news.instagram_post",
      targetTable: "news_items",
      targetId: newsId,
      meta: { media_id: posted.mediaId, link: posted.articleUrl, publish_as: publishAs },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, result: { id: posted.mediaId }, link: posted.articleUrl });
  } catch (e: any) {
    if (jobId) {
      try {
        const auth = await requireStaffApi(request, "manage_news");
        if (auth.ok) {
          await logPipelineEvent(auth.service, {
            jobId,
            stage: "failed",
            status: "error",
            platform: "Instagram",
            message: e?.message ?? "Unknown error",
            actorId: auth.userId
          });
          await updateAutomationJob(auth.service, jobId, {
            status: "failed",
            attempts: 1,
            error: e?.message ?? "Unknown error",
            finishedAt: new Date().toISOString()
          });
        }
      } catch {
        // no-op
      }
    }
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
