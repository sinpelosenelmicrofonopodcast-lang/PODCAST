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

function safeExt(name: string) {
  const raw = name.split(".").pop()?.toLowerCase() ?? "jpg";
  if (!raw.match(/^[a-z0-9]{1,8}$/)) return "jpg";
  return raw;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_promotions");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const form = await request.formData();
    const file = form.get("file");
    const oldPath = String(form.get("oldPath") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "Falta file." }, { status: 400 });
    }

    const { service } = getClients();

    // Best-effort cleanup of previous image to avoid orphaned storage objects.
    if (oldPath) {
      await service.storage.from("promotions-media").remove([oldPath]).catch(() => null);
    }

    const ext = safeExt(file.name);
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const path = `promotions/${Date.now()}_${Math.random().toString(16).slice(2)}.${ext}`;

    const { error: uploadError } = await service.storage.from("promotions-media").upload(path, bytes, {
      contentType: file.type || "image/jpeg",
      upsert: true
    });

    if (uploadError) return NextResponse.json({ ok: false, error: uploadError.message }, { status: 400 });

    const { data: publicData } = service.storage.from("promotions-media").getPublicUrl(path);
    const publicUrl = publicData?.publicUrl ?? null;

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.promotions.upload_image",
      targetTable: "promotions",
      targetId: null,
      meta: { path, old_path: oldPath || null, content_type: file.type || null },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, path, publicUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
