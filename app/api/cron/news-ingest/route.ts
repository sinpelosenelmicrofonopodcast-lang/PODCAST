import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { isCronAuthorized } from "@/lib/jobs/cronAuth";
import { runNewsIngestionPipeline } from "@/lib/news/pipeline";
import { cleanupStaleDraftArticles } from "@/lib/news/editorial";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  const service = supabaseService();
  let jobId = "";

  try {
    jobId = await createAutomationJob(service, {
      jobType: "spm_news_engine_run",
      source: "spm_news_engine",
      title: "SPM News Engine automatic ingestion",
      contentType: "news",
      payload: {
        cadence: "30m",
        draftOnly: true,
        cleanupHours: 48
      },
      status: "running",
      priority: 30
    });

    await logPipelineEvent(service, {
      jobId,
      stage: "ingested",
      status: "info",
      contentType: "news",
      message: "SPM News Engine inició ciclo automático"
    });

    let cleanupError: string | null = null;
    const cleanup = await cleanupStaleDraftArticles(service, 48).catch((error: any) => {
      cleanupError = error?.message ?? "No se pudo limpiar drafts viejos.";
      return {
        deleted: 0,
        legacyDeleted: 0,
        cutoffHours: 48,
        cutoffIso: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
        titles: []
      };
    });

    await logPipelineEvent(service, {
      jobId,
      stage: "draft",
      status: cleanupError ? "error" : "info",
      contentType: "news",
      message: cleanupError
        ? `Limpieza automática falló: ${cleanupError}`
        : `Limpieza automática: ${cleanup.deleted} drafts y ${cleanup.legacyDeleted} espejos legacy removidos.`,
      meta: cleanupError ? { ...cleanup, error: cleanupError } : cleanup
    });

    const summary = await runNewsIngestionPipeline(
      {
        sourceLimit: 50,
        perSourceLimit: 12,
        timeoutMs: 12000,
        rankedLimit: 18
      },
      service
    );

    const finalSummary = {
      ...summary,
      cleanupDeleted: cleanup.deleted,
      cleanupLegacyDeleted: cleanup.legacyDeleted
    };

    await logPipelineEvent(service, {
      jobId,
      stage: "draft",
      status: summary.failed > 0 ? "info" : "ok",
      contentType: "news",
      message: "SPM News Engine completó ciclo automático",
      meta: finalSummary
    });

    await updateAutomationJob(service, jobId, {
      status: "done",
      finishedAt: new Date().toISOString(),
      payload: finalSummary
    });

    return NextResponse.json({
      ok: true,
      engine: "spm_news_engine",
      summary: finalSummary
    });
  } catch (error: any) {
    if (jobId) {
      await logPipelineEvent(service, {
        jobId,
        stage: "failed",
        status: "error",
        contentType: "news",
        message: error?.message ?? "SPM News Engine failed"
      }).catch(() => null);

      await updateAutomationJob(service, jobId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: error?.message ?? "SPM News Engine failed"
      }).catch(() => null);
    }

    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = POST;
