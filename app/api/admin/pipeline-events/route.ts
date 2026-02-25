import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";

type PipelineEventRow = {
  id: string;
  job_id: string | null;
  stage: string;
  status: string;
  content_type: string | null;
  content_id: string | null;
  platform: string | null;
  message: string | null;
  meta: Record<string, any> | null;
  created_at: string;
};

type FailedJobRow = {
  id: string;
  job_type: string;
  source: string | null;
  content_type: string | null;
  content_id: string | null;
  title: string | null;
  error: string | null;
  finished_at: string | null;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "view_reports");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "250");
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 250;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [eventsResp, failedJobsResp, jobs24Resp, audit24Resp] = await Promise.all([
      auth.service
        .from("pipeline_events")
        .select("id, job_id, stage, status, content_type, content_id, platform, message, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(limit),
      auth.service
        .from("automation_jobs")
        .select("id, job_type, source, content_type, content_id, title, error, finished_at, updated_at")
        .eq("status", "failed")
        .order("updated_at", { ascending: false })
        .limit(50),
      auth.service
        .from("automation_jobs")
        .select("id, job_type, status, created_at, finished_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
      auth.service
        .from("admin_audit_logs")
        .select("id")
        .gte("created_at", since)
    ]);

    if (eventsResp.error) return NextResponse.json({ ok: false, error: eventsResp.error.message }, { status: 400 });
    if (failedJobsResp.error) return NextResponse.json({ ok: false, error: failedJobsResp.error.message }, { status: 400 });
    if (jobs24Resp.error) return NextResponse.json({ ok: false, error: jobs24Resp.error.message }, { status: 400 });

    const events = (eventsResp.data ?? []) as PipelineEventRow[];
    const failedJobs = (failedJobsResp.data ?? []) as FailedJobRow[];
    const events24h = events.filter((e) => e.created_at >= since);
    const jobs24 = (jobs24Resp.data ?? []) as Array<{
      id: string;
      job_type: string;
      status: string;
      created_at: string;
      finished_at: string | null;
    }>;

    const byStage: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    events24h.forEach((e) => {
      byStage[e.stage] = (byStage[e.stage] ?? 0) + 1;
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    });

    const funnel = {
      ingested: events24h.filter((e) => e.stage === "ingest" && e.status === "ok").length,
      drafted: events24h.filter((e) => e.stage === "draft" && (e.status === "ok" || e.status === "info")).length,
      published: events24h.filter((e) => e.stage === "publish" && e.status === "ok").length,
      social: events24h.filter((e) => e.stage === "social" && e.status === "ok").length,
      failed: events24h.filter((e) => e.status === "error").length
    };

    const jobsByType = jobs24.reduce<Record<string, number>>((acc, row) => {
      acc[row.job_type] = (acc[row.job_type] ?? 0) + 1;
      return acc;
    }, {});
    const doneJobs = jobs24.filter((j) => j.status === "done").length;
    const failedJobsCount24 = jobs24.filter((j) => j.status === "failed").length;
    const completionRate = jobs24.length > 0 ? Math.round((doneJobs / jobs24.length) * 100) : 0;

    const auditEvents24h = audit24Resp.error ? null : Number((audit24Resp.data ?? []).length);

    return NextResponse.json({
      ok: true,
      summary: {
        window: "24h",
        totalEvents: events24h.length,
        byStage,
        byStatus
      },
      kpis: {
        jobs24h: jobs24.length,
        done24h: doneJobs,
        failed24h: failedJobsCount24,
        completionRate,
        jobsByType,
        adminActions24h: auditEvents24h
      },
      funnel,
      events,
      failedJobs
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
