import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";

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
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "250");
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, Math.floor(limitRaw))) : 250;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [eventsResp, failedJobsResp] = await Promise.all([
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
        .limit(50)
    ]);

    if (eventsResp.error) return NextResponse.json({ ok: false, error: eventsResp.error.message }, { status: 400 });
    if (failedJobsResp.error) return NextResponse.json({ ok: false, error: failedJobsResp.error.message }, { status: 400 });

    const events = (eventsResp.data ?? []) as PipelineEventRow[];
    const failedJobs = (failedJobsResp.data ?? []) as FailedJobRow[];
    const events24h = events.filter((e) => e.created_at >= since);

    const byStage: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    events24h.forEach((e) => {
      byStage[e.stage] = (byStage[e.stage] ?? 0) + 1;
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
    });

    return NextResponse.json({
      ok: true,
      summary: {
        window: "24h",
        totalEvents: events24h.length,
        byStage,
        byStatus
      },
      events,
      failedJobs
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
