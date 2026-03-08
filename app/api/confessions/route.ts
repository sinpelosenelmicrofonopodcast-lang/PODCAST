import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { getUserIdFromBearer } from "@/lib/authToken";
import { checkRateLimit } from "@/lib/validations/rateLimit";
import { asBoolean, asOptionalString, asString } from "@/lib/validations/common";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const limited = checkRateLimit(`api:confessions:${ip}`, 3, 15 * 60_000);
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "Límite alcanzado. Intenta más tarde." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const confessionBody = asString(body?.body, 3000);
    if (confessionBody.length < 10) {
      return NextResponse.json({ ok: false, error: "Confesión muy corta." }, { status: 400 });
    }

    const userId = await getUserIdFromBearer(request.headers.get("authorization"));
    const service = supabaseService();

    const insert = await service
      .from("confessions")
      .insert({
        title: asOptionalString(body?.title, 180),
        body: confessionBody,
        media_url: asOptionalString(body?.mediaUrl, 600),
        is_anonymous: asBoolean(body?.isAnonymous, true),
        status: "pending",
        category: asOptionalString(body?.category, 50),
        region: asOptionalString(body?.region, 30),
        created_by: userId,
        author_id: userId,
        level: "public"
      })
      .select("id,status,created_at")
      .limit(1)
      .maybeSingle();

    if (insert.error || !insert.data?.id) {
      return NextResponse.json({ ok: false, error: insert.error?.message ?? "No se pudo guardar." }, { status: 400 });
    }

    return NextResponse.json({ ok: true, confession: insert.data });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
