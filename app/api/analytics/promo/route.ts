import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

const VALID_EVENTS = new Set(["impression", "click", "dismiss"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const promotionId = String(body?.promotionId ?? "").trim();
    const placement = String(body?.placement ?? "").trim();
    const event = String(body?.event ?? "").trim();
    const path = String(body?.path ?? "").trim();
    const sessionId = String(body?.sessionId ?? "").trim();

    if (!promotionId || !placement || !event || !path || !sessionId || !VALID_EVENTS.has(event)) {
      return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { error } = await supabase.from("promotion_events").insert({
      promotion_id: promotionId,
      placement,
      event,
      path,
      session_id: sessionId
    });

    if (error) {
      console.error("promotion analytics insert failed", {
        promotionId,
        placement,
        event,
        path,
        error: error.message
      });
      return NextResponse.json({ ok: false, error: "Tracking unavailable" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("promotion analytics route failed", error?.message ?? error);
    return NextResponse.json({ ok: false, error: "Tracking unavailable" }, { status: 500 });
  }
}
