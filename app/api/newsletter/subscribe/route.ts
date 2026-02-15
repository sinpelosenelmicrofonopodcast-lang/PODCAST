import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

function isEmail(value: string) {
  // pragmatic validation; avoid rejecting real-world emails.
  const v = String(value ?? "").trim();
  if (v.length < 6 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const email = String(body?.email ?? "").trim().toLowerCase();
    const sourcePath = String(body?.sourcePath ?? "").trim().slice(0, 240) || null;
    const preferredLanguage = String(body?.preferredLanguage ?? "").trim().slice(0, 16) || null;

    if (!isEmail(email)) return NextResponse.json({ ok: false, error: "Email invalido." }, { status: 400 });

    const supabase = getAnonClient();

    // Insert only. If the email already exists (unique index on lower(email)), treat it as success.
    // This avoids needing public UPDATE RLS policies.
    const { error } = await supabase.from("newsletter_subscribers").insert({
      email,
      status: "active",
      source_path: sourcePath,
      preferred_language: preferredLanguage,
      updated_at: new Date().toISOString()
    });

    const code = (error as any)?.code ?? null;
    if (error && code !== "23505") return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
