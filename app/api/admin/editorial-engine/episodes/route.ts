import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_news");
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const id = String(request.nextUrl.searchParams.get("id") ?? "").trim();
  if (id) {
    const { data, error } = await auth.service
      .from("editorial_episode_sources")
      .select("id,episode_code,title,guest,source_url,source_provider,drive_file_id,metadata,transcript_char_count,updated_at")
      .eq("id", id)
      .eq("active", true)
      .maybeSingle();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ ok: false, error: "Fuente no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true, item: data });
  }

  const { data, error } = await auth.service
    .from("editorial_episode_sources")
    .select("id,episode_code,title,guest,source_url,source_provider,drive_file_id,metadata,transcript_char_count,updated_at")
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}
