import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/jobs/cronAuth";
import { runTrendDetector } from "@/lib/trends/detector";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  try {
    const summary = await runTrendDetector();
    return NextResponse.json({ ok: true, summary });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = POST;
