import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/adminAuth";
import { isStaffPermission, type StaffPermission } from "@/lib/staffPermissions";

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const service = createClient(url, serviceKey);
  return { service };
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

type UserPermissionRow = {
  user_id: string;
  permission: string;
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
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const { service } = getClients();

    const [usersResp, membershipsResp, privateResp, rolesResp, permissionsResp, authUsers] = await Promise.all([
      service.from("users").select("id, nickname, user_status, created_at").order("created_at", { ascending: false }),
      service.from("memberships").select("user_id, plan, status"),
      service.from("user_private_profiles").select("user_id, first_name, last_name"),
      service.from("user_roles").select("user_id, roles(name)"),
      service.from("user_permissions").select("user_id, permission"),
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

    const permissionsByUser = new Map<string, StaffPermission[]>();
    ((permissionsResp.data as UserPermissionRow[]) ?? []).forEach((row) => {
      const permission = String(row.permission ?? "").trim();
      if (!isStaffPermission(permission)) return;
      const current = permissionsByUser.get(row.user_id) ?? [];
      if (!current.includes(permission)) current.push(permission);
      permissionsByUser.set(row.user_id, current);
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
        roles: rolesByUser.get(u.id) ?? [],
        permissions: permissionsByUser.get(u.id) ?? []
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
