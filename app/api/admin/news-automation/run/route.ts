import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_news_sources");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const body = await request.json().catch(() => ({}));
    const task = String(body?.task ?? "").trim(); // "ingest" | "process"
    if (!["ingest", "process"].includes(task)) {
      return NextResponse.json({ ok: false, error: "Task inválida." }, { status: 400 });
    }

    const secret = process.env.CRON_SECRET ?? "";
    if (!secret) return NextResponse.json({ ok: false, error: "Falta CRON_SECRET en servidor." }, { status: 500 });

    const path = task === "ingest" ? "/api/cron/news-ingest" : "/api/cron/process-jobs";
    const url = `${request.nextUrl.origin}${path}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      cache: "no-store"
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: json?.error ?? `No se pudo ejecutar ${task}.`, details: json },
        { status: res.status }
      );
    }
    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.news_automation.run",
      targetTable: "automation_jobs",
      targetId: null,
      meta: { task, result: json?.summary ?? null },
      ...reqMeta
    });
    return NextResponse.json({ ok: true, task, result: json });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
