import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { getFacebookFansOverview } from "@/lib/facebookFans";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const range = request.nextUrl.searchParams.get("range");
    const start = request.nextUrl.searchParams.get("start");
    const end = request.nextUrl.searchParams.get("end");
    const postId = request.nextUrl.searchParams.get("postId");

    const overview = await getFacebookFansOverview(auth.service, { range, start, end, postId });
    return NextResponse.json({ ok: true, ...overview });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

