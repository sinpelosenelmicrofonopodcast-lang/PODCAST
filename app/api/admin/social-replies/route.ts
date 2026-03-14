import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import {
  getSocialAutoReplySettings,
  normalizeSocialAutoReplySettings,
  upsertSocialAutoReplySettings
} from "@/lib/socialAutoReply";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const settings = await getSocialAutoReplySettings(auth.service);
    const eventsRes = await auth.service
      .from("social_comment_events")
      .select(
        "id,event_key,platform,comment_id,parent_comment_id,post_id,media_id,sender_id,sender_name,message,decision,matched_rule,reply_attempted,reply_sent,reply_comment_id,reply_message,error,processed_at,created_at"
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (eventsRes.error) return NextResponse.json({ ok: false, error: eventsRes.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, settings, events: eventsRes.data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const normalized = normalizeSocialAutoReplySettings(body);
    const saved = await upsertSocialAutoReplySettings(auth.service, normalized);
    return NextResponse.json({ ok: true, settings: saved });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
