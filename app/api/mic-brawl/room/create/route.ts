import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, ensureMicBrawlProfile, resolveUserFromRequest } from "@/lib/micBrawlServer";

export async function POST(request: NextRequest) {
  try {
    const session = await resolveUserFromRequest(request);
    if (!session) return NextResponse.json({ ok: false, error: "Debes iniciar sesión." }, { status: 401 });

    const service = createServiceClient();
    await ensureMicBrawlProfile(service, session.user);

    const { data, error } = await service
      .from("mic_brawl_rooms")
      .insert({
        status: "open",
        host_id: session.user.id,
        last_activity: new Date().toISOString()
      })
      .select("id,status,host_id,guest_id,created_at,updated_at,last_activity")
      .single();

    if (error || !data) return NextResponse.json({ ok: false, error: error?.message ?? "No se pudo crear sala." }, { status: 400 });

    return NextResponse.json({ ok: true, room: data, role: "host" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error creando sala." }, { status: 500 });
  }
}

