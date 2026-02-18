import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/authCookies";

function cookieBaseOptions(maxAge?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(typeof maxAge === "number" ? { maxAge } : {})
  };
}

function getAnonClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, anonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = String(body?.accessToken ?? "").trim();
    const refreshToken = String(body?.refreshToken ?? "").trim();
    const expiresIn = Number(body?.expiresIn ?? 60 * 60);

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ ok: false, error: "Faltan tokens de sesión." }, { status: 400 });
    }

    const supabase = getAnonClient(accessToken);
    const { data: userData, error } = await supabase.auth.getUser(accessToken);
    if (error || !userData.user?.id) {
      return NextResponse.json({ ok: false, error: "Token inválido." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, cookieBaseOptions(Math.max(60, Math.floor(expiresIn))));
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, cookieBaseOptions(60 * 60 * 24 * 30));
    return response;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", cookieBaseOptions(0));
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", cookieBaseOptions(0));
  return response;
}

