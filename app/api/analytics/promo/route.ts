import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const promotionId = String(body?.promotionId ?? "").trim();
    const placement = String(body?.placement ?? "").trim();
    const event = String(body?.event ?? "").trim();
    const path = String(body?.path ?? "").trim();
    const sessionId = String(body?.sessionId ?? "").trim();

    if (!promotionId || !placement || !event || !path || !sessionId) {
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
      // Best-effort. Don't fail UX if tracking fails.
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

