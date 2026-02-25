import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const service = createClient(url, serviceKey);
  return { service };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_promotions");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const body = await request.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });

    const { service } = getClients();
    const { data: promo, error } = await service
      .from("promotions")
      .select("id, image_path")
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    const imagePath = (promo as any)?.image_path ? String((promo as any).image_path) : "";
    if (imagePath) {
      await service.storage.from("promotions-media").remove([imagePath]).catch(() => null);
    }

    await service
      .from("promotions")
      .update({ image_url: null, image_path: null, updated_at: new Date().toISOString() })
      .eq("id", id);

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.promotions.cleanup_image",
      targetTable: "promotions",
      targetId: id,
      meta: { removed_path: imagePath || null },
      ...reqMeta
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
