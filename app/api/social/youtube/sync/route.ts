import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { syncYouTubeToExternalPosts } from "@/lib/youtubeSync";

export async function POST(request: NextRequest) {
  let jobId = "";
  try {
    const auth = await requireStaffApi(request, "manage_news_sources");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    jobId = await createAutomationJob(auth.service, {
      jobType: "youtube_sync",
      source: "youtube",
      title: "Sincronización YouTube",
      status: "running",
      createdBy: auth.userId
    });
    await logPipelineEvent(auth.service, {
      jobId,
      stage: "ingested",
      status: "info",
      platform: "YouTube",
      message: "Inicio de sincronización de YouTube",
      actorId: auth.userId
    });

    const sync = await syncYouTubeToExternalPosts(auth.service, { limit: 50 });

    await logPipelineEvent(auth.service, {
      jobId,
      stage: "published",
      status: "ok",
      platform: "YouTube",
      message: "Sincronización completada",
      meta: {
        totalFetched: sync.totalFetched,
        inserted: sync.inserted,
        updated: sync.updated
      },
      actorId: auth.userId
    });
    await updateAutomationJob(auth.service, jobId, {
      status: "done",
      attempts: 1,
      finishedAt: new Date().toISOString(),
      payload: {
        totalFetched: sync.totalFetched,
        inserted: sync.inserted,
        updated: sync.updated
      }
    });

    return NextResponse.json({ ok: true, ...sync });
  } catch (error: any) {
    if (jobId) {
      try {
        const admin = await requireStaffApi(request, "manage_news_sources");
        if (admin.ok) {
          await logPipelineEvent(admin.service, {
            jobId,
            stage: "failed",
            status: "error",
            platform: "YouTube",
            message: error?.message ?? "Unknown error",
            actorId: admin.userId
          });
          await updateAutomationJob(admin.service, jobId, {
            status: "failed",
            attempts: 1,
            error: error?.message ?? "Unknown error",
            finishedAt: new Date().toISOString()
          });
        }
      } catch {
        // no-op
      }
    }
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
