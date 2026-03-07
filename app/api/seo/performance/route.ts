import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getGscPerformance } from "@/lib/seo/gsc";

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, "view_stats");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const range = String(request.nextUrl.searchParams.get("range") ?? "28d");
  try {
    const performance = await getGscPerformance(range);
    return NextResponse.json({ ok: true, ...performance });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "No se pudo consultar rendimiento GSC.") }, { status: 500 });
  }
}

