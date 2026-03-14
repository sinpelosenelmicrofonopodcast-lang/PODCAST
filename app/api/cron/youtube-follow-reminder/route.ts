import { NextRequest, NextResponse } from "next/server";
import { scheduleDailyYoutubeFollowReminder } from "@/lib/autoPostCampaigns";
import { isCronAuthorized } from "@/lib/jobs/cronAuth";
import { supabaseService } from "@/lib/supabaseService";

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call." }, { status: 401 });
  }

  try {
    const service = supabaseService();
    const result = await scheduleDailyYoutubeFollowReminder(service);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export const GET = POST;
