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
  if (!token) return { ok: false as const, status: 401, userId: null as string | null };

  const { anon, service } = getClients();
  const { data: userData } = await anon.auth.getUser(token);
  const requesterId = userData.user?.id ?? null;
  if (!requesterId) return { ok: false as const, status: 401, userId: null as string | null };

  const { data: roles } = await service
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", requesterId);

  const isAdmin = (roles ?? []).some((row: any) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.name === "admin";
  });

  if (!isAdmin) return { ok: false as const, status: 403, userId: requesterId };
  return { ok: true as const, status: 200, userId: requesterId };
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

    const userId = params.id;
    const { service } = getClients();

    // Prevent self-delete from admin panel.
    if (auth.userId === userId) {
      return NextResponse.json({ ok: false, error: "No puedes eliminar tu propia cuenta admin." }, { status: 400 });
    }

    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en variables del servidor." },
        { status: 500 }
      );
    }

    const auth = await requireAdmin(request);
    if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

    const userId = params.id;
    const { service } = getClients();

    const payload = await request.json().catch(() => ({}));

    const userStatus = typeof payload?.user_status === "string" ? payload.user_status : null;
    const roleName = typeof payload?.role === "string" ? payload.role : null;
    const roleEnabled = typeof payload?.enabled === "boolean" ? payload.enabled : null;

    if (userStatus) {
      if (!["active", "blocked"].includes(userStatus)) {
        return NextResponse.json({ ok: false, error: "Estado inválido." }, { status: 400 });
      }
      const { error } = await service.from("users").update({ user_status: userStatus }).eq("id", userId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    if (roleName && roleEnabled !== null) {
      if (!["admin", "editor", "moderator"].includes(roleName)) {
        return NextResponse.json({ ok: false, error: "Rol inválido." }, { status: 400 });
      }

      const { data: roleRow, error: roleErr } = await service.from("roles").select("id, name").eq("name", roleName).single();
      if (roleErr || !roleRow?.id) return NextResponse.json({ ok: false, error: roleErr?.message ?? "Rol no existe." }, { status: 400 });

      if (roleEnabled) {
        const { error } = await service.from("user_roles").upsert({ user_id: userId, role_id: roleRow.id });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      } else {
        // Prevent removing own admin role via this endpoint.
        if (auth.userId === userId && roleName === "admin") {
          return NextResponse.json({ ok: false, error: "No puedes quitarte tu propio rol admin." }, { status: 400 });
        }
        const { error } = await service.from("user_roles").delete().eq("user_id", userId).eq("role_id", roleRow.id);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Nada para actualizar." }, { status: 400 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
