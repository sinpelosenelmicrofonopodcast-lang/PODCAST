import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminAuth";

const ALLOWED_TABLES = new Set([
  "confessions",
  "theories",
  "threads",
  "replies",
  "news_items",
  "blog_posts",
  "live_events",
  "promotions",
  "guest_requests"
]);

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => null);
    const table = String(body?.table ?? "").trim();
    const id = String(body?.id ?? "").trim();

    if (!ALLOWED_TABLES.has(table)) return NextResponse.json({ ok: false, error: "Tabla no permitida." }, { status: 400 });
    if (!isUuid(id)) return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });

    // Best-effort cleanup of comments when present (some projects add this table later).
    const deleteRelatedComments = async () => {
      const map: Record<string, string> = {
        confessions: "confession",
        news_items: "news",
        blog_posts: "blog"
      };
      const contentType = map[table];
      if (!contentType) return;
      try {
        await auth.service
          .from("comments")
          .delete()
          .eq("content_type", contentType)
          .eq("content_id", id);
      } catch {
        // Ignore: comments table may not exist yet in some environments.
      }
    };

    await deleteRelatedComments();

    const { error } = await auth.service.from(table).delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
