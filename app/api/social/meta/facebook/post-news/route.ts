import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAnonClient(authToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, anonKey, {
    global: authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
  });
}

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401 };

  const supabase = getAnonClient(token);
  const { data: userData } = await supabase.auth.getUser(token);
  const requesterId = userData.user?.id ?? null;
  if (!requesterId) return { ok: false as const, status: 401 };

  const { data: roles, error } = await supabase.from("user_roles").select("roles(name)").eq("user_id", requesterId);
  if (error) return { ok: false as const, status: 500 };

  const isAdmin = (roles ?? []).some((row: any) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.name === "admin";
  });
  if (!isAdmin) return { ok: false as const, status: 403 };
  return { ok: true as const, status: 200 };
}

function getConfig() {
  const pageId = process.env.META_PAGE_ID ?? "";
  const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN ?? "";
  const graphVersion = process.env.META_GRAPH_VERSION ?? "v24.0";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return { pageId, pageAccessToken, graphVersion, baseUrl };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

    const { pageId, pageAccessToken, graphVersion, baseUrl } = getConfig();
    if (!pageId || !pageAccessToken) {
      return NextResponse.json(
        { ok: false, error: "Faltan META_PAGE_ID o META_PAGE_ACCESS_TOKEN en variables del servidor." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const newsId = String(body?.newsId ?? "").trim();
    const title = String(body?.title ?? "").trim();
    const summary = String(body?.summary ?? "").trim();

    if (!newsId) return NextResponse.json({ ok: false, error: "newsId requerido." }, { status: 400 });

    const link = `${baseUrl.replace(/\/$/, "")}/noticias/${encodeURIComponent(newsId)}`;
    const message = summary ? `${title}\n\n${summary}` : title;

    const form = new URLSearchParams();
    form.set("message", message || "Nueva noticia");
    form.set("link", link);
    form.set("access_token", pageAccessToken);

    const res = await fetch(`https://graph.facebook.com/${graphVersion}/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: json?.error?.message ?? "Meta API error", details: json }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: json, link });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
