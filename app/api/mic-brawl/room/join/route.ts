import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, ensureMicBrawlProfile, parseJsonBody, resolveUserFromRequest } from "@/lib/micBrawlServer";

type JoinBody = {
  roomId?: string;
};

export async function POST(request: NextRequest) {
  try {
    const session = await resolveUserFromRequest(request);
    if (!session) return NextResponse.json({ ok: false, error: "Debes iniciar sesión." }, { status: 401 });

    const body = parseJsonBody<JoinBody>(await request.json().catch(() => ({})));
    const service = createServiceClient();
    await ensureMicBrawlProfile(service, session.user);

    let targetRoomId = String(body.roomId ?? "").trim();
    if (!targetRoomId) {
      const { data: openRoom, error: openError } = await service
        .from("mic_brawl_rooms")
        .select("id")
        .eq("status", "open")
        .is("guest_id", null)
        .neq("host_id", session.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (openError) {
        return NextResponse.json({ ok: false, error: openError.message }, { status: 400 });
      }
      if (!openRoom?.id) {
        return NextResponse.json({ ok: false, error: "No hay salas abiertas ahora." }, { status: 404 });
      }
      targetRoomId = openRoom.id;
    }

    const { data: joined, error: joinError } = await service
      .from("mic_brawl_rooms")
      .update({
        guest_id: session.user.id,
        status: "full",
        last_activity: new Date().toISOString()
      })
      .eq("id", targetRoomId)
      .eq("status", "open")
      .is("guest_id", null)
      .neq("host_id", session.user.id)
      .select("id,status,host_id,guest_id,created_at,updated_at,last_activity")
      .single();

    if (joinError || !joined) {
      return NextResponse.json({ ok: false, error: "Sala no disponible. Intenta otra vez." }, { status: 409 });
    }

    return NextResponse.json({ ok: true, room: joined, role: "guest" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error al entrar a sala." }, { status: 500 });
  }
}

