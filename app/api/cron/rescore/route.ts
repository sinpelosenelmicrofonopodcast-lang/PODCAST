import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { isCronAuthorized } from "@/lib/jobs/cronAuth";
import { aggregateAnalytics } from "@/lib/analytics/aggregate";
import { rescorePublishedArticles } from "@/lib/news/editorial";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  try {
    const service = supabaseService();
    const aggregation = await aggregateAnalytics(service, 24);
    const rescoring = await rescorePublishedArticles(service, 300);
    return NextResponse.json({ ok: true, aggregation, rescoring });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = POST;
