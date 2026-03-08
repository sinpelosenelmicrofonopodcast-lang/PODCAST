import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";

const TASK_TO_PATH: Record<string, string> = {
  ingest: "/api/cron/news-ingest",
  trends: "/api/cron/trends",
  publish_scheduled: "/api/cron/publish-scheduled",
  process_jobs: "/api/cron/process-jobs",
  rescore: "/api/cron/rescore",
  resurfacer: "/api/cron/content-resurfacer",
  analytics: "/api/cron/analytics-aggregation"
};

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const task = String(body?.task ?? "").trim();
    const path = TASK_TO_PATH[task];
    if (!path) return NextResponse.json({ ok: false, error: "Task inválida." }, { status: 400 });

    const secret = process.env.CRON_SECRET ?? "";
    if (!secret) return NextResponse.json({ ok: false, error: "Falta CRON_SECRET en servidor." }, { status: 500 });

    const url = `${request.nextUrl.origin}${path}`;
    const cronRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`
      },
      cache: "no-store"
    });

    const json = await cronRes.json().catch(() => ({}));
    if (!cronRes.ok) {
      return NextResponse.json({ ok: false, error: json?.error ?? "Cron falló.", details: json }, { status: cronRes.status });
    }

    return NextResponse.json({ ok: true, task, result: json });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
