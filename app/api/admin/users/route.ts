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

  const { data: roles } = await service
    .from("user_roles")
    .select("roles(name)")
    .eq("user_id", requesterId);

  const isAdmin = (roles ?? []).some((row: any) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role?.name === "admin";
  });

  if (!isAdmin) return { ok: false as const, status: 403 };
  return { ok: true as const, status: 200 };
}

type PublicUser = {
  id: string;
  nickname: string;
  user_status: string | null;
  created_at: string | null;
};

type Membership = {
  user_id: string;
  plan: string;
  status: string;
};

type PrivateProfile = {
  user_id: string;
  first_name: string;
  last_name: string;
};

type UserRoleRow = {
  user_id: string;
  roles: { name: string } | { name: string }[] | null;
};

async function listAllAuthUsers(service: any) {
  const users: Array<{ id: string; email: string | null }> = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const chunk = data?.users ?? [];
    users.push(...chunk.map((u: any) => ({ id: u.id, email: u.email ?? null })));
    if (chunk.length < perPage) break;
    page += 1;
  }

  return users;
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, error: "Falta SUPABASE_SERVICE_ROLE_KEY en variables del servidor." },
        { status: 500 }
      );
    }

    const auth = await requireAdmin(request);
    if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

    const { service } = getClients();

    const [usersResp, membershipsResp, privateResp, rolesResp, authUsers] = await Promise.all([
      service.from("users").select("id, nickname, user_status, created_at").order("created_at", { ascending: false }),
      service.from("memberships").select("user_id, plan, status"),
      service.from("user_private_profiles").select("user_id, first_name, last_name"),
      service.from("user_roles").select("user_id, roles(name)"),
      listAllAuthUsers(service)
    ]);

    if (usersResp.error) {
      return NextResponse.json({ ok: false, error: usersResp.error.message }, { status: 400 });
    }

    const emailByUser = new Map<string, string | null>(authUsers.map((u) => [u.id, u.email]));
    const membershipsByUser = new Map<string, Membership>(
      ((membershipsResp.data as Membership[]) ?? []).map((m) => [m.user_id, m])
    );
    const privateByUser = new Map<string, PrivateProfile>(
      ((privateResp.data as PrivateProfile[]) ?? []).map((p) => [p.user_id, p])
    );

    const rolesByUser = new Map<string, string[]>();
    ((rolesResp.data as UserRoleRow[]) ?? []).forEach((row) => {
      const roleObj = Array.isArray(row.roles) ? row.roles[0] : row.roles;
      const roleName = roleObj?.name;
      if (!roleName) return;
      const current = rolesByUser.get(row.user_id) ?? [];
      current.push(roleName);
      rolesByUser.set(row.user_id, current);
    });

    const items = ((usersResp.data as PublicUser[]) ?? []).map((u) => {
      const membership = membershipsByUser.get(u.id);
      const privateData = privateByUser.get(u.id);
      return {
        id: u.id,
        nickname: u.nickname,
        email: emailByUser.get(u.id) ?? null,
        user_status: u.user_status,
        created_at: u.created_at,
        first_name: privateData?.first_name ?? null,
        last_name: privateData?.last_name ?? null,
        plan: membership?.plan ?? "free",
        membership_status: membership?.status ?? "active",
        roles: rolesByUser.get(u.id) ?? []
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
