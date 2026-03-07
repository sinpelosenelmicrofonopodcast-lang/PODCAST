import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
import { withScheduledPostsMigrationHint } from "@/lib/supabaseErrorHints";

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
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
      .delete()
      .eq("id", id)
      .in("status", ["queued", "failed", "cancelled"])
      .select("id")
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: withScheduledPostsMigrationHint(error) }, { status: 400 });
    if (!data) {
      return NextResponse.json(
        { ok: false, error: "Solo se pueden eliminar estados en queued, failed o cancelled." },
        { status: 409 }
      );
    }

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.auto_posts.purge",
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
