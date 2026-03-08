import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { buildFansCsv, getFacebookFansOverview } from "@/lib/facebookFans";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const range = request.nextUrl.searchParams.get("range");
    const start = request.nextUrl.searchParams.get("start");
    const end = request.nextUrl.searchParams.get("end");
    const postId = request.nextUrl.searchParams.get("postId");

    const overview = await getFacebookFansOverview(auth.service, { range, start, end, postId });
    const csv = buildFansCsv(overview.top_fans ?? []);
    const now = new Date().toISOString().slice(0, 10);
    const filename = `facebook_fans_activos_${now}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

