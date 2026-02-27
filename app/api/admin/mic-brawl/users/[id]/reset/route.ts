import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";

type Params = { params: { id: string } };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const userId = String(params.id ?? "").trim();
    if (!userId) return NextResponse.json({ ok: false, error: "user id requerido." }, { status: 400 });

    const { error } = await auth.service
      .from("profiles")
      .update({ wins: 0, losses: 0, kos: 0, matches: 0, equipped_skin: "classic" })
      .eq("id", userId);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "No se pudo resetear stats." }, { status: 500 });
  }
}

