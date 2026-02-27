import { NextRequest, NextResponse } from "next/server";
import { createUserClientFromToken, parseJsonBody, resolveUserFromRequest } from "@/lib/micBrawlServer";

type Body = {
  roomId?: string;
  winnerId?: string;
  durationSeconds?: number;
  winnerKo?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const session = await resolveUserFromRequest(request);
    if (!session) return NextResponse.json({ ok: false, error: "Debes iniciar sesión." }, { status: 401 });
    const body = parseJsonBody<Body>(await request.json().catch(() => ({})));

    const roomId = String(body.roomId ?? "").trim();
    const winnerId = String(body.winnerId ?? "").trim();
    const durationSeconds = Number(body.durationSeconds ?? 0);
    const winnerKo = body.winnerKo !== false;

    if (!roomId || !winnerId) {
      return NextResponse.json({ ok: false, error: "roomId y winnerId son requeridos." }, { status: 400 });
    }

    const userClient = createUserClientFromToken(session.token);
    const { data, error } = await userClient.rpc("mic_brawl_finalize_match", {
      p_room_id: roomId,
      p_winner_id: winnerId,
      p_duration_seconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
      p_winner_ko: winnerKo
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, matchId: data ?? null });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "No se pudo finalizar la partida." }, { status: 500 });
  }
}

