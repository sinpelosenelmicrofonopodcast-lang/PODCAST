"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authJsonFetch, getClientAccessToken } from "@/lib/clientApi";
import { hasAnyPermission, type StaffPermission } from "@/lib/staffPermissions";
import { toast } from "@/lib/toast";

const TABLE_PERMISSIONS: Record<string, StaffPermission> = {
  confessions: "moderate_confessions",
  theories: "moderate_theories",
  threads: "moderate_community",
  replies: "moderate_community",
  news_items: "manage_news",
  blog_posts: "manage_blog",
  live_events: "manage_events",
  promotions: "manage_promotions",
  guest_requests: "manage_guest_requests"
};

export function AdminDeleteButton({ table, id, label = "Eliminar" }: { table: string; id: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canShow, setCanShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setCanShow(false);
      const token = await getClientAccessToken();
      if (!token) return;
      const res = await authJsonFetch("/api/admin/me").catch(() => null);
      if (!mounted) return;
      if (!res?.response.ok) return;
      const json = res.json;
      const isAdmin = Boolean(json?.isAdmin);
      const permissions = Array.isArray(json?.permissions) ? (json.permissions as StaffPermission[]) : [];
      const required = TABLE_PERMISSIONS[table];
      if (isAdmin || (required && hasAnyPermission({ isAdmin, permissions }, required))) setCanShow(true);
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este contenido?")) return;
    setLoading(true);
    setError(null);
    const token = await getClientAccessToken();
    if (!token) return setError("No hay sesión activa. Inicia sesión como admin."), void setLoading(false);

    const res = await authJsonFetch("/api/admin/delete", {
      method: "POST",
      jsonBody: { table, id }
    }).catch(() => null);

    const json = res?.json;
    if (!res?.response.ok || !json?.ok) {
      const msg = json?.error ?? `No se pudo eliminar (HTTP ${res?.response.status ?? "?"}).`;
      setError(msg);
      toast.error(msg);
      setLoading(false);
      return;
    }

    if (res?.response.ok) {
      toast.success("Eliminado.");
      router.refresh();
    }
    setLoading(false);
  };

  if (!canShow) return null;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button className="button secondary" type="button" onClick={handleDelete} disabled={loading}>
        {loading ? "Eliminando..." : label}
      </button>
      {error ? <span className="muted" style={{ fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}
