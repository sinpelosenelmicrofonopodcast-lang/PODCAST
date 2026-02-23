import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { postNewsToFacebook } from "@/lib/socialFacebook";

type QueueJob = {
  id: string;
  job_type: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  payload: Record<string, any> | null;
  content_type: string | null;
  content_id: string | null;
  attempts: number;
  max_attempts: number;
};

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
  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await service
      .from("automation_jobs")
      .select("id, job_type, status, payload, content_type, content_id, attempts, max_attempts")
      .eq("status", "queued")
      .lte("scheduled_for", nowIso)
      .order("priority", { ascending: true })
      .order("scheduled_for", { ascending: true })
      .limit(20);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    const jobs = (data ?? []) as QueueJob[];

    let done = 0;
    let failed = 0;
    let skipped = 0;

    for (const job of jobs) {
      const nextAttempts = Number(job.attempts ?? 0) + 1;
      await updateAutomationJob(service, job.id, {
        status: "running",
        attempts: nextAttempts,
        startedAt: new Date().toISOString(),
        error: null
      });

      try {
        if (job.job_type === "facebook_post_news") {
          const newsId = String(job.payload?.newsId ?? job.content_id ?? "").trim();
          const title = String(job.payload?.title ?? "").trim();
          const summary = String(job.payload?.summary ?? "").trim();
          if (!newsId) throw new Error("Job inválido: falta newsId.");

          const posted = await postNewsToFacebook({ newsId, title, summary });

          await service.from("external_posts").upsert(
            {
              platform: "Facebook",
              external_id: posted.postId || `news-${newsId}`,
              title: title || null,
              caption: summary || null,
              media_url: null,
              metrics: null,
              posted_at: new Date().toISOString(),
              source_url: posted.link
            },
            { onConflict: "platform,external_id", ignoreDuplicates: true }
          );

          await logPipelineEvent(service, {
            jobId: job.id,
            stage: "social",
            status: "ok",
            contentType: "news",
            contentId: newsId,
            platform: "Facebook",
            message: "Post publicado por worker",
            meta: { postId: posted.postId, link: posted.link }
          });
          await updateAutomationJob(service, job.id, {
            status: "done",
            finishedAt: new Date().toISOString(),
            payload: { ...(job.payload ?? {}), postId: posted.postId, link: posted.link }
          });
          done += 1;
          continue;
        }

        await logPipelineEvent(service, {
          jobId: job.id,
          stage: "failed",
          status: "error",
          contentType: job.content_type,
          contentId: job.content_id,
          message: `Job type no soportado: ${job.job_type}`
        });
        await updateAutomationJob(service, job.id, {
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: `Job type no soportado: ${job.job_type}`
        });
        skipped += 1;
      } catch (e: any) {
        const exceeded = nextAttempts >= Number(job.max_attempts ?? 3);
        await logPipelineEvent(service, {
          jobId: job.id,
          stage: "failed",
          status: "error",
          contentType: job.content_type,
          contentId: job.content_id,
          message: e?.message ?? "Error procesando job",
          meta: { attempt: nextAttempts, max_attempts: job.max_attempts }
        });
        await updateAutomationJob(service, job.id, {
          status: exceeded ? "failed" : "queued",
          finishedAt: exceeded ? new Date().toISOString() : null,
          error: e?.message ?? "Error procesando job"
        });
        failed += 1;
      }
    }

    return NextResponse.json({ ok: true, total: jobs.length, done, failed, skipped });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
