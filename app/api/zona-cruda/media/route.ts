import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const anon = createClient(url, anonKey);
  const service = createClient(url, serviceKey);
  return { anon, service };
}

async function requirePaid21(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401, userId: null as string | null };

  const { anon, service } = getClients();
  const { data: userData } = await anon.auth.getUser(token);
  const userId = userData.user?.id ?? null;
  if (!userId) return { ok: false as const, status: 401, userId: null as string | null };

  const [{ data: profile }, { data: membership }] = await Promise.all([
    service.from("users").select("is_21_confirmed, terms_accepted, legal_ack_at").eq("id", userId).single(),
    service.from("memberships").select("status, plan").eq("user_id", userId).single()
  ]);

  const ok =
    profile?.is_21_confirmed === true &&
    profile?.terms_accepted === true &&
    !!profile?.legal_ack_at &&
    membership?.status === "active" &&
    membership?.plan === "paid";

  if (!ok) return { ok: false as const, status: 403, userId };
  return { ok: true as const, status: 200, userId };
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en variables del servidor." },
        { status: 500 }
      );
    }

    const auth = await requirePaid21(request);
    if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const paths: string[] = Array.isArray(body?.paths) ? body.paths : [];
    if (paths.length === 0) return NextResponse.json({ ok: true, urls: [] });

    const { service } = getClients();
    const expiresIn = 60 * 30; // 30 min

    const results = await Promise.all(
      paths.map(async (path) => {
        const { data, error } = await service.storage.from("ugc").createSignedUrl(path, expiresIn);
        return {
          path,
          signedUrl: data?.signedUrl ?? null,
          error: error?.message ?? null
        };
      })
    );

    return NextResponse.json({ ok: true, urls: results });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

