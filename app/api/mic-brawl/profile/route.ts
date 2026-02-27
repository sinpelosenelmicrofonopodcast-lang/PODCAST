import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, ensureMicBrawlProfile, resolveUserFromRequest } from "@/lib/micBrawlServer";

export async function GET(request: NextRequest) {
  try {
    const session = await resolveUserFromRequest(request);
    if (!session) return NextResponse.json({ ok: true, authenticated: false, profile: null });

    const service = createServiceClient();
    await ensureMicBrawlProfile(service, session.user);

    const { data: profile, error } = await service
      .from("profiles")
      .select("id,handle,equipped_skin,wins,losses,kos,matches,is_admin,created_at")
      .eq("id", session.user.id)
      .single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true, authenticated: true, profile });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error cargando perfil." }, { status: 500 });
  }
}

