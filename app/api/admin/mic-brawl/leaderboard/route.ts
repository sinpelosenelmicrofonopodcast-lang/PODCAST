import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const { data, error } = await auth.service
      .from("profiles")
      .select("id,handle,equipped_skin,wins,losses,kos,matches,is_admin,created_at")
      .order("wins", { ascending: false })
      .order("kos", { ascending: false })
      .order("matches", { ascending: false })
      .limit(300);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, items: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error cargando leaderboard admin." }, { status: 500 });
  }
}

