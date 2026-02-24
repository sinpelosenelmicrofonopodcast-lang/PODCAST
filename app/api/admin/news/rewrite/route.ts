import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { createAutomationJob, logPipelineEvent } from "@/lib/pipelineOps";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const newsId = String(body?.newsId ?? "").trim();
    const shouldPublish = body?.shouldPublish === true;
    const autoPostFacebook = body?.autoPostFacebook === true;
    const runNow = body?.runNow !== false;
    if (!isUuid(newsId)) return NextResponse.json({ ok: false, error: "newsId inválido." }, { status: 400 });

    const newsResp = await auth.service
      .from("news_items")
      .select("id, title, publication_state, source_url")
      .eq("id", newsId)
      .limit(1)
      .maybeSingle();

    if (newsResp.error) return NextResponse.json({ ok: false, error: newsResp.error.message }, { status: 400 });
    if (!newsResp.data) return NextResponse.json({ ok: false, error: "Noticia no encontrada." }, { status: 404 });

    const news = newsResp.data as { id: string; title: string | null; publication_state: "draft" | "published" | null };
    const shouldPublishFinal = shouldPublish || (news.publication_state ?? "draft") === "published";

    const pendingResp = await auth.service
      .from("automation_jobs")
      .select("id, status")
      .eq("job_type", "rewrite_news")
      .eq("content_type", "news")
      .eq("content_id", newsId)
      .in("status", ["queued", "running"])
      .limit(1)
      .maybeSingle();

    if (pendingResp.error) return NextResponse.json({ ok: false, error: pendingResp.error.message }, { status: 400 });
    if (pendingResp.data?.id) {
      return NextResponse.json({ ok: true, queued: true, alreadyQueued: true, jobId: pendingResp.data.id });
    }

    const rewritePatch = await auth.service
      .from("news_items")
      .update({
        rewrite_status: "queued",
        rewrite_error: null
      })
      .eq("id", newsId);

    if (rewritePatch.error && /rewrite_status|rewrite_error/i.test(rewritePatch.error.message ?? "")) {
      return NextResponse.json(
        { ok: false, error: "Faltan columnas IA en news_items. Ejecuta supabase/news_ai_rewrite.sql." },
        { status: 400 }
      );
    }

    const jobId = await createAutomationJob(auth.service, {
      jobType: "rewrite_news",
      source: "admin",
      title: news.title ?? "Reescritura IA",
      contentType: "news",
      contentId: newsId,
      payload: {
        newsId,
        sourceName: "admin",
        shouldPublish: shouldPublishFinal,
        autoPostFacebook,
        requestedBy: auth.userId
      },
      status: "queued",
      priority: 10,
      scheduledFor: new Date().toISOString(),
      createdBy: auth.userId
    });

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "draft",
      status: "info",
      contentType: "news",
      contentId: newsId,
      message: "Reescritura IA encolada desde admin",
      actorId: auth.userId
    });

    let workerResult: any = null;
    if (runNow) {
      const secret = process.env.CRON_SECRET ?? "";
      if (secret) {
        const worker = await fetch(`${request.nextUrl.origin}/api/cron/process-jobs`, {
          method: "POST",
          headers: { Authorization: `Bearer ${secret}` },
          cache: "no-store"
        });
        workerResult = await worker.json().catch(() => null);
      }
    }

    return NextResponse.json({
      ok: true,
      queued: true,
      jobId,
      worker: workerResult
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
