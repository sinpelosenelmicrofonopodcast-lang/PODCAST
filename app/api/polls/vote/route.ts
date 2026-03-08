import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { getUserIdFromBearer } from "@/lib/authToken";
import { checkRateLimit } from "@/lib/validations/rateLimit";
import { asString, isUuid } from "@/lib/validations/common";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const limited = checkRateLimit(`api:polls:vote:${ip}`, 12, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "Demasiadas acciones. Intenta luego." }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const pollId = asString(body?.pollId, 80);
    const optionId = asString(body?.optionId, 80);
    const sessionId = asString(body?.sessionId || request.cookies.get("spm_sid")?.value || ip, 120);

    if (!isUuid(pollId) || !isUuid(optionId)) {
      return NextResponse.json({ ok: false, error: "Parámetros inválidos." }, { status: 400 });
    }

    const userId = await getUserIdFromBearer(request.headers.get("authorization"));
    const service = supabaseService();

    const poll = await service.from("article_polls").select("id,active").eq("id", pollId).limit(1).maybeSingle();
    if (poll.error || !poll.data?.id || poll.data.active !== true) {
      return NextResponse.json({ ok: false, error: "Encuesta no disponible." }, { status: 404 });
    }

    const insert = await service.from("article_poll_votes").insert({
      poll_id: pollId,
      option_id: optionId,
      user_id: userId,
      session_id: userId ? null : sessionId
    });

    if (insert.error) {
      const msg = String(insert.error.message ?? "");
      if (msg.includes("duplicate") || insert.error.code === "23505") {
        return NextResponse.json({ ok: false, error: "Ya votaste en esta encuesta." }, { status: 409 });
      }
      return NextResponse.json({ ok: false, error: insert.error.message }, { status: 400 });
    }

    const totals = await service
      .from("article_poll_votes")
      .select("option_id")
      .eq("poll_id", pollId);

    if (totals.error) {
      return NextResponse.json({ ok: true, voted: true, totals: [] });
    }

    const map = new Map<string, number>();
    (totals.data ?? []).forEach((row: any) => {
      const id = String(row.option_id ?? "");
      map.set(id, (map.get(id) ?? 0) + 1);
    });

    return NextResponse.json({
      ok: true,
      voted: true,
      totals: Array.from(map.entries()).map(([id, count]) => ({ optionId: id, votes: count }))
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
