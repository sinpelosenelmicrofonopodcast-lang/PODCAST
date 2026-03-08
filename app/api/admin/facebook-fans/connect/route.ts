import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";
import { connectFacebookPage } from "@/lib/facebookFans";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const connection = await connectFacebookPage(auth.service);
    const reqMeta = getRequestAuditMeta(request);

    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.facebook_fans.connect",
      targetTable: "facebook_pages",
      targetId: connection.pageId,
      meta: { page_name: connection.pageName, permissions: connection.permissions ?? [] },
      ...reqMeta
    });

    return NextResponse.json({ ok: true, connection });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

