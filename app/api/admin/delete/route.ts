import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_TABLES = new Set([
  "confessions",
  "theories",
  "threads",
  "replies",
  "news_items",
  "blog_posts",
  "live_events",
  "promotions"
]);

function getClients(authToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const anon = createClient(url, anonKey, {
    global: authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
  });
  const service = createClient(url, serviceKey);
  return { anon, service };
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401, error: "Falta token." };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { ok: false as const, status: 500, error: "Falta SUPABASE_SERVICE_ROLE_KEY." };

  const { anon, service } = getClients(token);
  const { data: userData } = await anon.auth.getUser(token);
  const requesterId = userData.user?.id ?? null;
  if (!requesterId) return { ok: false as const, status: 401, error: "Sesión inválida." };

  const { data: roles, error } = await service.from("user_roles").select("roles(name)").eq("user_id", requesterId);
  if (error) return { ok: false as const, status: 500, error: error.message };

  const isAdmin =
    (roles ?? []).some((row: any) => {
      const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      return role?.name === "admin";
    }) ?? false;

  if (!isAdmin) return { ok: false as const, status: 403, error: "No autorizado." };
  return { ok: true as const, status: 200, token, requesterId, service };
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
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
