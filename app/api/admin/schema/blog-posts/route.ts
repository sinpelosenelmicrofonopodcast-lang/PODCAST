import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffApi } from "@/lib/adminAuth";

const REQUIRED_COLUMNS = ["id", "title", "excerpt", "body", "cover_url", "created_at", "author_id"] as const;
const RECOMMENDED_COLUMNS = [
  "slug",
  "meta_description",
  "reading_time_minutes",
  "categories",
  "tags",
  "updated_at",
  "episode_url",
  "episode_title"
] as const;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffApi(request, "manage_blog");
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const service = getServiceClient();
    const columnsResp = await service
      .schema("information_schema")
      .from("columns")
      .select("column_name")
      .eq("table_schema", "public")
      .eq("table_name", "blog_posts");

    if (columnsResp.error) {
      return NextResponse.json({ ok: false, error: columnsResp.error.message }, { status: 400 });
    }

    const existing = new Set((columnsResp.data ?? []).map((row: any) => String(row?.column_name ?? "").trim()));
    const missingRequired = REQUIRED_COLUMNS.filter((column) => !existing.has(column));
    const missingRecommended = RECOMMENDED_COLUMNS.filter((column) => !existing.has(column));

    return NextResponse.json({
      ok: true,
      table: "public.blog_posts",
      healthy: missingRequired.length === 0,
      missingRequired,
      missingRecommended
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

