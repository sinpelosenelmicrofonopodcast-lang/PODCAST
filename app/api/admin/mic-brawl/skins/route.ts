import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";

type CreateBody = {
  id?: string;
  display_name?: string;
  unlock_wins?: number | null;
  is_active?: boolean;
  palette?: Record<string, string> | null;
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const { data, error } = await auth.service
      .from("mic_brawl_skins")
      .select("id,display_name,unlock_wins,is_active,palette,created_at")
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error cargando skins." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const body = (await request.json().catch(() => ({}))) as CreateBody;

    const id = String(body.id ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "");
    const displayName = String(body.display_name ?? "").trim();
    if (!id || !displayName) return NextResponse.json({ ok: false, error: "id y display_name requeridos." }, { status: 400 });

    const row = {
      id,
      display_name: displayName,
      unlock_wins: body.unlock_wins == null ? null : Number(body.unlock_wins),
      is_active: body.is_active !== false,
      palette: body.palette ?? null
    };

    const { data, error } = await auth.service.from("mic_brawl_skins").upsert(row).select("id").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error guardando skin." }, { status: 500 });
  }
}

