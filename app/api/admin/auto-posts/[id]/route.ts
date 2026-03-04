import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
import { withScheduledPostsMigrationHint } from "@/lib/supabaseErrorHints";

const EDITABLE_STATUS = new Set(["queued", "cancelled"]);

type PatchPayload = {
  message?: string;
  status?: "queued" | "cancelled";
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const id = String(params.id ?? "").trim();
    if (!isUuid(id)) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const payload = (await request.json().catch(() => ({}))) as PatchPayload;
    const patch: Record<string, any> = {};

    if (payload.message !== undefined) {
      const message = String(payload.message ?? "").trim();
      if (!message) return NextResponse.json({ ok: false, error: "Mensaje requerido." }, { status: 400 });
      patch.message = message;
    }

    if (payload.status !== undefined) {
      const status = String(payload.status ?? "").trim().toLowerCase();
      if (!EDITABLE_STATUS.has(status)) {
        return NextResponse.json({ ok: false, error: "Status inválido para edición." }, { status: 400 });
      }
      patch.status = status;
      if (status === "queued") patch.error = null;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ ok: false, error: "Nada para actualizar." }, { status: 400 });
    }

    const { data, error } = await auth.service
      .from("scheduled_posts")
      .update(patch)
      .eq("id", id)
      .in("status", ["queued", "failed", "cancelled"])
      .select("id, platform, message, media_url, scheduled_for, status, posted_at, remote_id, error, created_by, created_at, updated_at")
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: withScheduledPostsMigrationHint(error) }, { status: 400 });
    if (!data) return NextResponse.json({ ok: false, error: "No editable (ya publicado o en proceso)." }, { status: 409 });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.auto_posts.update",
      targetTable: "scheduled_posts",
      targetId: id,
      meta: { fields: Object.keys(patch) },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const id = String(params.id ?? "").trim();
    if (!isUuid(id)) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });

    const { data, error } = await auth.service
      .from("scheduled_posts")
      .update({ status: "cancelled" })
      .eq("id", id)
      .in("status", ["queued", "failed"])
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: withScheduledPostsMigrationHint(error) }, { status: 400 });
    if (!data) return NextResponse.json({ ok: false, error: "No se pudo cancelar (ya publicado o en proceso)." }, { status: 409 });

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.auto_posts.cancel",
      targetTable: "scheduled_posts",
      targetId: id,
      meta: {},
      ...reqMeta
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
