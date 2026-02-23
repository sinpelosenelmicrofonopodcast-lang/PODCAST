import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";

type JobRow = {
  id: string;
  job_type: string;
  source: string | null;
  title: string | null;
  content_type: string | null;
  content_id: string | null;
  content_title: string | null;
  status: string;
  priority: number;
  scheduled_for: string;
  started_at: string | null;
  finished_at: string | null;
  attempts: number;
  max_attempts: number;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const limitRaw = Number(request.nextUrl.searchParams.get("limit") ?? "150");
    const limit = Number.isFinite(limitRaw) ? Math.min(300, Math.max(1, Math.floor(limitRaw))) : 150;

    const jobsResp = await auth.service
      .from("admin_schedule_jobs")
      .select(
        "id, job_type, source, title, content_type, content_id, content_title, status, priority, scheduled_for, started_at, finished_at, attempts, max_attempts, error, created_at, updated_at"
      )
      .order("scheduled_for", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (jobsResp.error) {
      return NextResponse.json({ ok: false, error: jobsResp.error.message }, { status: 400 });
    }

    const jobs = (jobsResp.data ?? []) as JobRow[];
    const summary = jobs.reduce(
      (acc, row) => {
        acc.total += 1;
        acc.byStatus[row.status] = (acc.byStatus[row.status] ?? 0) + 1;
        return acc;
      },
      { total: 0, byStatus: {} as Record<string, number> }
    );

    return NextResponse.json({ ok: true, jobs, summary });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
