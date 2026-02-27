import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/micBrawlServer";

export async function GET(_request: NextRequest) {
  try {
    const service = createServiceClient();
    const { data, error } = await service
      .from("mic_brawl_skins")
      .select("id,display_name,unlock_wins,is_active,palette,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error cargando skins." }, { status: 500 });
  }
}

