import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, parseJsonBody, resolveUserFromRequest } from "@/lib/micBrawlServer";

type Body = { roomId?: string };

export async function POST(request: NextRequest) {
  try {
    const session = await resolveUserFromRequest(request);
    if (!session) return NextResponse.json({ ok: false, error: "Debes iniciar sesión." }, { status: 401 });
    const body = parseJsonBody<Body>(await request.json().catch(() => ({})));
    const roomId = String(body.roomId ?? "").trim();
    if (!roomId) return NextResponse.json({ ok: false, error: "roomId requerido." }, { status: 400 });

    const service = createServiceClient();
    const { data: room } = await service
      .from("mic_brawl_rooms")
      .select("id,status,host_id,guest_id")
      .eq("id", roomId)
      .single();
    if (!room) return NextResponse.json({ ok: false, error: "Sala no encontrada." }, { status: 404 });
    if (session.user.id !== room.host_id && session.user.id !== room.guest_id) {
      return NextResponse.json({ ok: false, error: "No perteneces a esta sala." }, { status: 403 });
    }

    await service
      .from("mic_brawl_rooms")
      .update({
        status: room.guest_id ? room.status === "open" ? "full" : room.status : room.status,
        last_activity: new Date().toISOString()
      })
      .eq("id", roomId);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error de heartbeat." }, { status: 500 });
  }
}

