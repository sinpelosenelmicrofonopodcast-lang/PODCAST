import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, ensureMicBrawlProfile, parseJsonBody, resolveUserFromRequest } from "@/lib/micBrawlServer";

type Body = { skinId?: string };

export async function POST(request: NextRequest) {
  try {
    const session = await resolveUserFromRequest(request);
    if (!session) return NextResponse.json({ ok: false, error: "Debes iniciar sesión." }, { status: 401 });

    const body = parseJsonBody<Body>(await request.json().catch(() => ({})));
    const skinId = String(body.skinId ?? "").trim();
    if (!skinId) return NextResponse.json({ ok: false, error: "skinId requerido." }, { status: 400 });

    const service = createServiceClient();
    await ensureMicBrawlProfile(service, session.user);

    const [{ data: profile }, { data: skin }] = await Promise.all([
      service.from("profiles").select("id,wins,equipped_skin").eq("id", session.user.id).single(),
      service.from("mic_brawl_skins").select("id,unlock_wins,is_active").eq("id", skinId).single()
    ]);

    if (!profile) return NextResponse.json({ ok: false, error: "Perfil no encontrado." }, { status: 404 });
    if (!skin || !skin.is_active) return NextResponse.json({ ok: false, error: "Skin no disponible." }, { status: 404 });
    if (skin.unlock_wins != null && Number(profile.wins ?? 0) < Number(skin.unlock_wins)) {
      return NextResponse.json({ ok: false, error: `Necesitas ${skin.unlock_wins} victorias para desbloquear esta skin.` }, { status: 403 });
    }

    const { error: updateError } = await service
      .from("profiles")
      .update({ equipped_skin: skinId })
      .eq("id", session.user.id);
    if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 400 });

    return NextResponse.json({ ok: true, equipped_skin: skinId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "No se pudo equipar skin." }, { status: 500 });
  }
}

