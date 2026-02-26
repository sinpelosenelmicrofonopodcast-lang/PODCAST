import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAutomationJob, logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { syncYouTubeToExternalPosts } from "@/lib/youtubeSync";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceKey) throw new Error("Faltan variables de Supabase para cron.");
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

function isCronAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;
  if ((request.headers.get("x-cron-secret") ?? "") === secret) return true;
  if ((request.nextUrl.searchParams.get("secret") ?? "") === secret) return true;
  return false;
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  const service = getServiceClient();
  let jobId = "";
  try {
    jobId = await createAutomationJob(service, {
      jobType: "youtube_sync",
      source: "youtube",
      title: "Cron YouTube Sync",
      status: "running"
    });
    await logPipelineEvent(service, {
      jobId,
      stage: "ingested",
      status: "info",
      platform: "YouTube",
      message: "Inicio de cron YouTube Sync"
    });

    const sync = await syncYouTubeToExternalPosts(service, { limit: 50 });

    await logPipelineEvent(service, {
      jobId,
      stage: "published",
      status: "ok",
      platform: "YouTube",
      message: "Cron YouTube Sync completado",
      meta: sync
    });
    await updateAutomationJob(service, jobId, {
      status: "done",
      attempts: 1,
      finishedAt: new Date().toISOString(),
      payload: sync
    });

    return NextResponse.json({ ok: true, ...sync });
  } catch (error: any) {
    if (jobId) {
      await updateAutomationJob(service, jobId, {
        status: "failed",
        attempts: 1,
        error: error?.message ?? "Unknown error",
        finishedAt: new Date().toISOString()
      }).catch(() => null);
      await logPipelineEvent(service, {
        jobId,
        stage: "failed",
        status: "error",
        platform: "YouTube",
        message: error?.message ?? "Unknown error"
      }).catch(() => null);
    }
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
