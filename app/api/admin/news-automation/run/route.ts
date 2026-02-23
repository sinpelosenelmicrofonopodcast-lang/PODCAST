import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

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
    return NextResponse.json({ ok: true, task, result: json });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
