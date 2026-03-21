import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { cleanupStaleDraftArticles } from "@/lib/news/editorial";

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const hoursRaw = Number(body?.hours ?? 48);
    const hours = Number.isFinite(hoursRaw) ? Math.max(1, Math.min(24 * 14, Math.floor(hoursRaw))) : 48;
    const result = await cleanupStaleDraftArticles(auth.service, hours);
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
