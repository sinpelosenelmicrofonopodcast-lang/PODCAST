import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { isCronAuthorized } from "@/lib/jobs/cronAuth";
import { aggregateAnalytics } from "@/lib/analytics/aggregate";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  try {
    const service = supabaseService();
    const hourly = await aggregateAnalytics(service, 1);
    const sixHours = await aggregateAnalytics(service, 6);
    const daily = await aggregateAnalytics(service, 24);

    return NextResponse.json({
      ok: true,
      windows: {
        "1h": hourly,
        "6h": sixHours,
        "24h": daily
      }
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = POST;
