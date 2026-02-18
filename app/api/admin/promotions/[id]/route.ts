import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/adminAuth";

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const service = createClient(url, serviceKey);
  return { service };
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const id = String(params.id ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });

    const { service } = getClients();
    const { data: promo } = await service.from("promotions").select("id, image_path").eq("id", id).single();
    const imagePath = (promo as any)?.image_path ? String((promo as any).image_path) : "";
    if (imagePath) {
      await service.storage.from("promotions-media").remove([imagePath]).catch(() => null);
    }

    const { error } = await service.from("promotions").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
