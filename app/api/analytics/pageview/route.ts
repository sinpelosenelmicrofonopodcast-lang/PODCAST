import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const visitorId = String(body?.visitorId ?? "").trim();
    const path = String(body?.path ?? "").trim() || "/";
    const referrer = body?.referrer ? String(body.referrer) : null;
    const userAgent = body?.userAgent ? String(body.userAgent) : null;

    if (!visitorId) {
      return NextResponse.json({ ok: false, error: "missing visitorId" }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: userData } = await supabase.auth.getUser();

    await supabase.from("page_visits").insert({
      visitor_id: visitorId,
      path,
      referrer,
      user_agent: userAgent,
      user_id: userData.user?.id ?? null,
      visited_at: new Date().toISOString()
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

