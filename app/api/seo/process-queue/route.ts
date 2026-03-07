import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { processSeoQueue } from "@/lib/seo/queue";

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, "view_schedule");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const limitRaw = Number(body?.limit ?? 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 50;

  try {
    const result = await processSeoQueue(limit);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "No se pudo procesar seo_queue.") }, { status: 500 });
  }
}

