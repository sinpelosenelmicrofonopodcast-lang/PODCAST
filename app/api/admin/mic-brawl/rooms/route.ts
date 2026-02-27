import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: rooms, error } = await auth.service
      .from("mic_brawl_rooms")
      .select("id,status,host_id,guest_id,created_at,updated_at,last_activity")
      .gte("last_activity", since)
      .order("last_activity", { ascending: false })
      .limit(200);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const ids = Array.from(
      new Set(
        (rooms ?? [])
          .flatMap((room: any) => [room.host_id, room.guest_id])
          .filter(Boolean)
          .map((value: any) => String(value))
      )
    );

    let handlesById = new Map<string, string>();
    if (ids.length) {
      const { data: profiles } = await auth.service.from("profiles").select("id,handle").in("id", ids);
      handlesById = new Map((profiles ?? []).map((p: any) => [String(p.id), String(p.handle)]));
    }

    const items = (rooms ?? []).map((room: any) => ({
      ...room,
      host_handle: room.host_id ? handlesById.get(String(room.host_id)) ?? null : null,
      guest_handle: room.guest_id ? handlesById.get(String(room.guest_id)) ?? null : null
    }));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error cargando salas." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = (await request.json().catch(() => ({}))) as { roomId?: string; status?: string };
    const roomId = String(body.roomId ?? "").trim();
    const status = String(body.status ?? "closed").trim();
    if (!roomId) return NextResponse.json({ ok: false, error: "roomId requerido." }, { status: 400 });
    if (!["closed", "finished", "open", "full"].includes(status)) {
      return NextResponse.json({ ok: false, error: "status inválido." }, { status: 400 });
    }

    const { error } = await auth.service
      .from("mic_brawl_rooms")
      .update({ status, last_activity: new Date().toISOString() })
      .eq("id", roomId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error actualizando sala." }, { status: 500 });
  }
}

