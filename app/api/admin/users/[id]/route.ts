import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/adminAuth";
import { isStaffPermission } from "@/lib/staffPermissions";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createClient(url, serviceKey);
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const userId = params.id;
    const service = getServiceClient();
    const reqMeta = getRequestAuditMeta(request);

    // Prevent self-delete from admin panel.
    if (auth.userId === userId) {
      return NextResponse.json({ ok: false, error: "No puedes eliminar tu propia cuenta admin." }, { status: 400 });
    }

    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }
    await logAdminAudit(auth.service, {
      actorId: auth.userId,
      action: "admin.user.delete",
      targetTable: "auth.users",
      targetId: userId,
      meta: {},
      ...reqMeta
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdminApi(request);
    if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

    const userId = params.id;
    const service = getServiceClient();
    const reqMeta = getRequestAuditMeta(request);

    const payload = await request.json().catch(() => ({}));

    const userStatus = typeof payload?.user_status === "string" ? payload.user_status : null;
    const roleName = typeof payload?.role === "string" ? payload.role : null;
    const roleEnabled = typeof payload?.enabled === "boolean" ? payload.enabled : null;
    const permissionName = typeof payload?.permission === "string" ? payload.permission : null;
    const permissionEnabled = typeof payload?.enabled === "boolean" ? payload.enabled : null;

    if (userStatus) {
      if (!["active", "blocked"].includes(userStatus)) {
        return NextResponse.json({ ok: false, error: "Estado inválido." }, { status: 400 });
      }
      const { error } = await service.from("users").update({ user_status: userStatus }).eq("id", userId);
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      await logAdminAudit(auth.service, {
        actorId: auth.userId,
        action: "admin.user.status.update",
        targetTable: "users",
        targetId: userId,
        meta: { user_status: userStatus },
        ...reqMeta
      });
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
      await logAdminAudit(auth.service, {
        actorId: auth.userId,
        action: "admin.user.role.update",
        targetTable: "user_roles",
        targetId: userId,
        meta: { role: roleName, enabled: roleEnabled },
        ...reqMeta
      });

      return NextResponse.json({ ok: true });
    }

    if (permissionName && permissionEnabled !== null) {
      const normalized = String(permissionName).trim();
      if (!isStaffPermission(normalized)) {
        return NextResponse.json({ ok: false, error: "Permiso inválido." }, { status: 400 });
      }
      if (permissionEnabled) {
        const { error } = await service
          .from("user_permissions")
          .upsert({ user_id: userId, permission: normalized, granted_by: auth.userId });
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      } else {
        const { error } = await service
          .from("user_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("permission", normalized);
        if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
      await logAdminAudit(auth.service, {
        actorId: auth.userId,
        action: "admin.user.permission.update",
        targetTable: "user_permissions",
        targetId: userId,
        meta: { permission: normalized, enabled: permissionEnabled },
        ...reqMeta
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: false, error: "Nada para actualizar." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
