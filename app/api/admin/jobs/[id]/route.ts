import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
import { logPipelineEvent } from "@/lib/pipelineOps";

type ManagedJobRow = {
  id: string;
  job_type: string;
  source: string | null;
  status: string;
  scheduled_for: string;
  content_id: string | null;
  title: string | null;
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireStaffApi(request, "manage_news");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);
    const id = String(params.id ?? "").trim();
    const body = await request.json().catch(() => ({}));
    const scheduleForRaw = String(body?.scheduledFor ?? "").trim();

    if (!id) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
    if (!scheduleForRaw) return NextResponse.json({ ok: false, error: "scheduledFor requerido." }, { status: 400 });

    const jobRes = await auth.service
      .from("automation_jobs")
      .select("id, job_type, source, status, scheduled_for, content_id, title")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (jobRes.error) return NextResponse.json({ ok: false, error: jobRes.error.message }, { status: 400 });
    const row = (jobRes.data ?? null) as ManagedJobRow | null;
    if (!row || row.job_type !== "facebook_post_episode") {
      return NextResponse.json({ ok: false, error: "Solo se puede reprogramar jobs de episodios en Facebook." }, { status: 400 });
    }
    if (["running", "done"].includes(row.status)) {
      return NextResponse.json({ ok: false, error: `No se puede reprogramar un job en status=${row.status}.` }, { status: 409 });
    }

    const parsed = new Date(scheduleForRaw);
    if (!Number.isFinite(parsed.getTime())) {
      return NextResponse.json({ ok: false, error: "scheduledFor inválido." }, { status: 400 });
    }
    if (parsed.getTime() <= Date.now() + 30_000) {
      return NextResponse.json({ ok: false, error: "La fecha programada debe ser futura (mínimo 30 segundos)." }, { status: 400 });
    }

    const scheduledForIso = parsed.toISOString();
    const updateRes = await auth.service
      .from("automation_jobs")
      .update({
        status: "queued",
        scheduled_for: scheduledForIso,
        error: null,
        started_at: null,
        finished_at: null
      })
      .eq("id", id)
      .select("id, status, scheduled_for")
      .maybeSingle();

    if (updateRes.error) return NextResponse.json({ ok: false, error: updateRes.error.message }, { status: 400 });

    await logPipelineEvent(auth.service, {
      jobId: id,
      stage: "social",
      status: "info",
      contentType: "episode",
      contentId: row.content_id,
      platform: "Facebook",
      message: "Job de episodio reprogramado desde admin",
      meta: { scheduled_for: scheduledForIso },
      actorId: auth.userId
    });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.jobs.reschedule_episode_post",
      targetTable: "automation_jobs",
      targetId: id,
      meta: { scheduled_for: scheduledForIso, previous_status: row.status, source: row.source },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, item: updateRes.data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireStaffApi(request, "manage_news");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);
    const id = String(params.id ?? "").trim();

    if (!id) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const jobRes = await auth.service
      .from("automation_jobs")
      .select("id, job_type, source, status, scheduled_for, content_id, title")
      .eq("id", id)
      .limit(1)
      .maybeSingle();

    if (jobRes.error) return NextResponse.json({ ok: false, error: jobRes.error.message }, { status: 400 });
    const row = (jobRes.data ?? null) as ManagedJobRow | null;
    if (!row || row.job_type !== "facebook_post_episode") {
      return NextResponse.json({ ok: false, error: "Solo se puede cancelar jobs de episodios en Facebook." }, { status: 400 });
    }
    if (["running", "done", "cancelled"].includes(row.status)) {
      return NextResponse.json({ ok: false, error: `No se puede cancelar un job en status=${row.status}.` }, { status: 409 });
    }

    const updateRes = await auth.service
      .from("automation_jobs")
      .update({
        status: "cancelled",
        finished_at: new Date().toISOString(),
        error: null
      })
      .eq("id", id)
      .select("id, status")
      .maybeSingle();

    if (updateRes.error) return NextResponse.json({ ok: false, error: updateRes.error.message }, { status: 400 });

    await logPipelineEvent(auth.service, {
      jobId: id,
      stage: "social",
      status: "info",
      contentType: "episode",
      contentId: row.content_id,
      platform: "Facebook",
      message: "Job de episodio cancelado desde admin",
      actorId: auth.userId
    });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.jobs.cancel_episode_post",
      targetTable: "automation_jobs",
      targetId: id,
      meta: { previous_status: row.status, source: row.source },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, item: updateRes.data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
