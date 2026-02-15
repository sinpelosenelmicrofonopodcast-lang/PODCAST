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

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return { ok: false as const, status: 401 };

  const { anon, service } = getClients();
  const { data: userData } = await anon.auth.getUser(token);
  const requesterId = userData.user?.id ?? null;
  if (!requesterId) return { ok: false as const, status: 401 };

  const { data: roles } = await service.from("user_roles").select("roles(name)").eq("user_id", requesterId);
  const isAdmin = (roles ?? []).some((row: any) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.name === "admin";
  });
  if (!isAdmin) return { ok: false as const, status: 403 };
  return { ok: true as const, status: 200 };
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en variables del servidor." },
        { status: 500 }
      );
    }

    const auth = await requireAdmin(request);
    if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

    const id = String(params.id ?? "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Falta id." }, { status: 400 });

    const { service } = getClients();
    const { data: promo } = await service.from("promotions").select("id, image_path").eq("id", id).single();
    const imagePath = (promo as any)?.image_path ? String((promo as any).image_path) : "";
    if (imagePath) {
      await service.storage.from("promotions-media").remove([imagePath]).catch(() => null);
    }

    const { error } = await service.from("promotions").delete().eq("id", id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

