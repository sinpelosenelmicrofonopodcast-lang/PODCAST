import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { chicagoDateInputFromNow, generateAutoPostDraftsSmart } from "@/lib/autoPosts";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
import { withScheduledPostsMigrationHint } from "@/lib/supabaseErrorHints";

type GeneratePayload = {
  date?: string;
  startTime?: string;
  endTime?: string;
  intervalMinutes?: number;
  countOverride?: number | null;
};

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
    const reqMeta = getRequestAuditMeta(request);

    const body = (await request.json().catch(() => ({}))) as GeneratePayload;
    const date = String(body?.date ?? chicagoDateInputFromNow()).trim();
    const drafts = await generateAutoPostDraftsSmart({
      date,
      startTime: body?.startTime,
      endTime: body?.endTime,
      intervalMinutes: body?.intervalMinutes,
      countOverride: body?.countOverride
    });

    if (drafts.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay espacios válidos para generar posts." }, { status: 400 });
    }

    const rows = drafts.map((draft) => ({
      platform: "facebook_page",
      message: draft.message,
      media_url: null,
      scheduled_for: draft.scheduledForUtc,
      status: "queued",
      created_by: auth.userId
    }));

    const upsert = await auth.service
      .from("scheduled_posts")
      .upsert(rows, { onConflict: "platform,scheduled_for", ignoreDuplicates: true })
      .select("id, scheduled_for, message, status");

    if (upsert.error) {
      return NextResponse.json({ ok: false, error: withScheduledPostsMigrationHint(upsert.error) }, { status: 400 });
    }

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.auto_posts.generate",
      targetTable: "scheduled_posts",
      targetId: null,
      meta: {
        date,
        requested: drafts.length,
        inserted: (upsert.data ?? []).length
      },
      ...reqMeta
    });

    return NextResponse.json({
      ok: true,
      date,
      timezone: "America/Chicago",
      requested: drafts.length,
      inserted: (upsert.data ?? []).length,
      items: upsert.data ?? []
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
