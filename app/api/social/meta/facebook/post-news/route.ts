import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { postNewsToFacebook } from "@/lib/socialFacebook";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

export async function POST(request: NextRequest) {
  let jobId = "";
  try {
    const auth = await requireStaffApi(request, "manage_news");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const body = await request.json().catch(() => ({}));
    const newsId = String(body?.newsId ?? "").trim();
    const newsSlug = String(body?.newsSlug ?? "").trim();
    const title = String(body?.title ?? "").trim();
    const summary = String(body?.summary ?? "").trim();

    if (!newsId) return NextResponse.json({ ok: false, error: "newsId requerido." }, { status: 400 });

    jobId = await createAutomationJob(auth.service, {
      jobType: "facebook_post_news",
      source: "facebook",
      title: title || "Publicar noticia en Facebook",
      contentType: "news",
      contentId: newsId,
      payload: { title, summary, newsSlug: newsSlug || null },
      status: "running",
      createdBy: auth.userId
    });
    await logPipelineEvent(auth.service, {
      jobId,
      stage: "social",
      status: "info",
      contentType: "news",
      contentId: newsId,
      platform: "Facebook",
      message: "Inicio de publicación en Facebook",
      actorId: auth.userId
    });
    const posted = await postNewsToFacebook({ newsId, newsSlug: newsSlug || null, title, summary });

    await auth.service.from("external_posts").upsert(
      {
        platform: "Facebook",
        external_id: String(posted.postId ?? `news-${newsId}`),
        title: title || null,
        caption: summary || null,
        media_url: null,
        metrics: null,
        posted_at: new Date().toISOString(),
        source_url: posted.link
      },
      { onConflict: "platform,external_id", ignoreDuplicates: true }
    );

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "social",
      status: "ok",
      contentType: "news",
      contentId: newsId,
      platform: "Facebook",
      message: "Noticia publicada en Facebook",
      meta: { postId: posted.postId ?? null, link: posted.link },
      actorId: auth.userId
    });
    await updateAutomationJob(auth.service, jobId, {
      status: "done",
      attempts: 1,
      finishedAt: new Date().toISOString(),
      payload: { title, summary, link: posted.link, postId: posted.postId ?? null }
    });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.news.facebook_post",
      targetTable: "news_items",
      targetId: newsId,
      meta: { post_id: posted.postId ?? null, link: posted.link },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, result: { id: posted.postId }, link: posted.link });
  } catch (e: any) {
    if (jobId) {
      try {
        const auth = await requireStaffApi(request, "manage_news");
        if (auth.ok) {
          await logPipelineEvent(auth.service, {
            jobId,
            stage: "failed",
            status: "error",
            platform: "Facebook",
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
