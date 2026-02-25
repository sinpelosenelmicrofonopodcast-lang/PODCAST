import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

function isMissingGeoColumnsError(message?: string | null) {
  const text = String(message ?? "");
  return /country_code|country|region|city/i.test(text) && /column/i.test(text);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const visitorId = String(body?.visitorId ?? "").trim();
    const path = String(body?.path ?? "").trim() || "/";
    const referrer = body?.referrer ? String(body.referrer) : null;
    const userAgent = body?.userAgent ? String(body.userAgent) : null;
    const countryCode =
      request.headers.get("x-vercel-ip-country") ??
      request.headers.get("cf-ipcountry") ??
      request.headers.get("x-country-code");
    const countryName = request.headers.get("x-vercel-ip-country-name") ?? request.headers.get("x-country-name");
    const region = request.headers.get("x-vercel-ip-country-region") ?? request.headers.get("x-region");
    const city = request.headers.get("x-vercel-ip-city") ?? request.headers.get("x-city");

    if (!visitorId) {
      return NextResponse.json({ ok: false, error: "missing visitorId" }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data: userData } = await supabase.auth.getUser();
    const visitedAt = new Date().toISOString();

    const row = {
      visitor_id: visitorId,
      path,
      referrer,
      user_agent: userAgent,
      user_id: userData.user?.id ?? null,
      visited_at: visitedAt,
      country_code: countryCode ? String(countryCode).toUpperCase() : null,
      country: countryName ? String(countryName) : null,
      region: region ? String(region) : null,
      city: city ? String(city) : null
    };

    const insertResp = await supabase.from("page_visits").insert(row);
    if (insertResp.error) {
      const canFallback = isMissingGeoColumnsError(insertResp.error.message);
      if (!canFallback) return NextResponse.json({ ok: false, error: insertResp.error.message }, { status: 400 });

      const fallback = await supabase.from("page_visits").insert({
        visitor_id: visitorId,
        path,
        referrer,
        user_agent: userAgent,
        user_id: userData.user?.id ?? null,
        visited_at: visitedAt
      });
      if (fallback.error) return NextResponse.json({ ok: false, error: fallback.error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
