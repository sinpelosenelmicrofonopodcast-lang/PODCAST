import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { deleteArticle, updateArticleEditorial } from "@/lib/news/editorial";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json().catch(() => ({}));
    const result = await updateArticleEditorial(auth.service, String(params.id ?? "").trim(), auth.userId, body ?? {});
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  try {
    const result = await deleteArticle(auth.service, String(params.id ?? "").trim());
    return NextResponse.json({ ok: true, result });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 400 });
  }
}
