import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { saveArticleSocialDrafts } from "@/lib/news/editorial";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const drafts = Array.isArray(body?.drafts) ? body.drafts : [];
    const result = await saveArticleSocialDrafts(auth.service, String(params.id ?? "").trim(), drafts);
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 400 });
  }
}
