import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, ensureMicBrawlProfile, resolveUserFromRequest } from "@/lib/micBrawlServer";

type Params = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const session = await resolveUserFromRequest(request);
    if (!session) return NextResponse.json({ ok: false, error: "Debes iniciar sesión." }, { status: 401 });

    const roomId = String(params.id ?? "").trim();
    if (!roomId) return NextResponse.json({ ok: false, error: "room id requerido." }, { status: 400 });

    const service = createServiceClient();
    await ensureMicBrawlProfile(service, session.user);

    const { data: room, error: roomError } = await service
      .from("mic_brawl_rooms")
      .select("id,status,host_id,guest_id,created_at,updated_at,last_activity")
      .eq("id", roomId)
      .single();
    if (roomError || !room) return NextResponse.json({ ok: false, error: roomError?.message ?? "Sala no encontrada." }, { status: 404 });

    if (session.user.id !== room.host_id && session.user.id !== room.guest_id) {
      return NextResponse.json({ ok: false, error: "No perteneces a esta sala." }, { status: 403 });
    }

    const playerIds = [room.host_id, room.guest_id].filter(Boolean) as string[];
    const { data: profiles } = await service
      .from("profiles")
      .select("id,handle,equipped_skin,wins,losses,kos,matches")
      .in("id", playerIds);

    const skinIds = Array.from(new Set((profiles ?? []).map((p: any) => String(p.equipped_skin ?? "classic"))));
    const { data: skins } = await service.from("mic_brawl_skins").select("id,display_name,palette,is_active").in("id", skinIds);

    const profileById = new Map((profiles ?? []).map((p: any) => [String(p.id), p]));
    const skinById = new Map((skins ?? []).map((s: any) => [String(s.id), s]));

    return NextResponse.json({
      ok: true,
      room,
      me: session.user.id,
      players: {
        host: room.host_id
          ? {
              id: room.host_id,
              profile: profileById.get(room.host_id) ?? null,
              skin: skinById.get(String(profileById.get(room.host_id)?.equipped_skin ?? "classic")) ?? null
            }
          : null,
        guest: room.guest_id
          ? {
              id: room.guest_id,
              profile: profileById.get(room.guest_id) ?? null,
              skin: skinById.get(String(profileById.get(room.guest_id)?.equipped_skin ?? "classic")) ?? null
            }
          : null
      }
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error cargando sala." }, { status: 500 });
  }
}

