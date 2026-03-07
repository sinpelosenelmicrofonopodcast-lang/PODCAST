import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { enqueueSeoUrl } from "@/lib/seo/queue";

export async function POST(request: NextRequest) {
  const auth = await requireStaffApi(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const url = String(body?.url ?? "").trim();
  const type = String(body?.type ?? "page").trim() as "post" | "episode" | "clip" | "event" | "page";
  if (!url) return NextResponse.json({ ok: false, error: "url requerido." }, { status: 400 });

  try {
    const result = await enqueueSeoUrl(url, type);
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? "No se pudo encolar URL SEO.") }, { status: 500 });
  }
}

