import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
import { logPipelineEvent, updateAutomationJob } from "@/lib/pipelineOps";
import { publishFacebookEpisodeAutomationJob } from "@/lib/facebookEpisodeJobs";

type ManagedJobRow = {
  id: string;
  job_type: string;
  source: string | null;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  content_id: string | null;
  payload: Record<string, any> | null;
  attempts: number;
  title: string | null;
};

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireStaffApi(request, "manage_news");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);
    const id = String(params.id ?? "").trim();

    if (!id) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const jobRes = await auth.service
      .from("automation_jobs")
      .select("id, job_type, source, status, content_id, payload, attempts, title")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (jobRes.error) return NextResponse.json({ ok: false, error: jobRes.error.message }, { status: 400 });
    const row = (jobRes.data ?? null) as ManagedJobRow | null;
    if (!row || row.job_type !== "facebook_post_episode") {
      return NextResponse.json({ ok: false, error: "Solo se puede publicar ahora jobs de episodios en Facebook." }, { status: 400 });
    }
    if (["running", "done"].includes(row.status)) {
      return NextResponse.json({ ok: false, error: `No disponible para post-now (status=${row.status}).` }, { status: 409 });
    }

    const nextAttempts = Number(row.attempts ?? 0) + 1;
    await updateAutomationJob(auth.service, id, {
      status: "running",
      attempts: nextAttempts,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null
    });

    try {
      const result = await publishFacebookEpisodeAutomationJob(
        auth.service,
        { id: row.id, payload: row.payload, content_id: row.content_id },
        { actorId: auth.userId }
      );

      await logAdminAudit(auth.service, {
        actorId: auth.userId,
        action: "admin.jobs.post_now_episode_post",
        targetTable: "automation_jobs",
        targetId: id,
        meta: { post_id: result.postId, link: result.link, source: row.source },
        ...reqMeta
      });

      return NextResponse.json({ ok: true, postId: result.postId, link: result.link });
    } catch (error: any) {
      const message = String(error?.message ?? "Error publicando job de episodio");
      await logPipelineEvent(auth.service, {
        jobId: id,
        stage: "failed",
        status: "error",
        contentType: "episode",
        contentId: row.content_id,
        platform: "Facebook",
        message,
        actorId: auth.userId
      });
      await updateAutomationJob(auth.service, id, {
        status: "failed",
        error: message,
        finishedAt: new Date().toISOString()
      });
      return NextResponse.json({ ok: false, error: message }, { status: 502 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
