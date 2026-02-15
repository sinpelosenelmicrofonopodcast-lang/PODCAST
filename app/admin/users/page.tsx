"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type FilterStatus = "all" | "active" | "blocked";
type RoleName = "admin" | "editor" | "moderator";

type AdminUserRow = {
  id: string;
  nickname: string;
  email: string | null;
  user_status: "active" | "blocked" | null;
  created_at: string | null;
  first_name: string | null;
  last_name: string | null;
  plan: string | null;
  membership_status: string | null;
  roles: string[];
};

async function getSessionToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentAdminId, setCurrentAdminId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");

  const load = async () => {
    setLoading(true);
    setStatus(null);

    const { data: authData } = await supabase.auth.getUser();
    setCurrentAdminId(authData.user?.id ?? null);

    const token = await getSessionToken();
    if (!token) {
      setItems([]);
      setLoading(false);
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }

    const response = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${token}` } });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setItems([]);
      setLoading(false);
      setStatus(json?.error ?? "No se pudo cargar usuarios.");
      return;
    }

    setItems((json?.items as AdminUserRow[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((u) => {
      const statusValue = u.user_status ?? "active";
      if (filter !== "all" && statusValue !== filter) return false;
      if (!term) return true;
      return (
        u.nickname.toLowerCase().includes(term) ||
        (u.email ?? "").toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term)
      );
    });
  }, [items, q, filter]);

  const updateUser = async (userId: string, payload: any) => {
    const token = await getSessionToken();
    if (!token) {
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return { ok: false as const };
    }
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(json?.error ?? "No se pudo actualizar usuario.");
      return { ok: false as const };
    }
    return { ok: true as const };
  };

  const toggleBlock = async (user: AdminUserRow) => {
    setBusyId(user.id);
    setStatus(null);
    const next = (user.user_status ?? "active") === "blocked" ? "active" : "blocked";
    const result = await updateUser(user.id, { user_status: next });
    setBusyId(null);
    if (!result.ok) return;
    setItems((prev) => prev.map((u) => (u.id === user.id ? { ...u, user_status: next } : u)));
  };

  const toggleRole = async (user: AdminUserRow, role: RoleName, enabled: boolean) => {
    setBusyId(user.id);
    setStatus(null);
    const result = await updateUser(user.id, { role, enabled });
    setBusyId(null);
    if (!result.ok) return;
    setItems((prev) =>
      prev.map((u) => {
        if (u.id !== user.id) return u;
        const current = Array.isArray(u.roles) ? u.roles : [];
        const next = enabled ? Array.from(new Set([...current, role])) : current.filter((r) => r !== role);
        return { ...u, roles: next };
      })
    );
  };

  const deleteUser = async (user: AdminUserRow) => {
    if (user.id === currentAdminId) {
      setStatus("No puedes eliminar tu propia cuenta.");
      return;
    }
    if (!window.confirm(`Eliminar usuario @${user.nickname}? Esta acción es irreversible.`)) return;

    setBusyId(user.id);
    setStatus(null);

    const token = await getSessionToken();
    if (!token) {
      setBusyId(null);
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }

    const response = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await response.json().catch(() => ({}));
    setBusyId(null);

    if (!response.ok) {
      setStatus(json?.error ?? "No se pudo eliminar usuario.");
      return;
    }
    setItems((prev) => prev.filter((u) => u.id !== user.id));
    setStatus(`Usuario @${user.nickname} eliminado.`);
  };

  return (
    <main>
      <h1 className="section-title">Usuarios</h1>
      <p className="muted">Buscar por nickname/email, filtrar por estado y asignar roles. Nombre legal solo visible aquí.</p>

      {status ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Buscar (nickname / email / id)
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ej: bito o gmail.com" />
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={filter === "all" ? "button" : "button secondary"} type="button" onClick={() => setFilter("all")}>
            Todos
          </button>
          <button
            className={filter === "active" ? "button" : "button secondary"}
            type="button"
            onClick={() => setFilter("active")}
          >
            Active
          </button>
          <button
            className={filter === "blocked" ? "button" : "button secondary"}
            type="button"
            onClick={() => setFilter("blocked")}
          >
            Blocked
          </button>
          <button className="button secondary" type="button" onClick={() => load()} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        {loading ? <p className="muted">Cargando usuarios...</p> : null}
        {!loading && filtered.length === 0 ? <p className="muted">No hay usuarios para mostrar.</p> : null}
        {!loading && filtered.length > 0 ? (
          <div className="list">
            {filtered.map((user) => {
              const isBlocked = (user.user_status ?? "active") === "blocked";
              const isSelf = user.id === currentAdminId;
              const roles = Array.isArray(user.roles) ? user.roles : [];

              const hasAdmin = roles.includes("admin");
              const hasEditor = roles.includes("editor");
              const hasModerator = roles.includes("moderator");

              return (
                <div key={user.id} className="card" style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <strong>@{user.nickname}</strong>
                    <span className={`news-badge`}>{isBlocked ? "blocked" : "active"}</span>
                  </div>

                  <div className="muted" style={{ fontSize: 13, display: "grid", gap: 4 }}>
                    <span>
                      Nombre legal: {user.first_name ?? "—"} {user.last_name ?? ""}
                    </span>
                    <span>Email: {user.email ?? "—"}</span>
                    <span>ID: {user.id}</span>
                    <span>Plan: {user.plan ?? "free"}</span>
                    <span>Membresía: {user.membership_status ?? "active"}</span>
                    <span>Creado: {user.created_at ? new Date(user.created_at).toLocaleString("es-PR") : "—"}</span>
                  </div>

                  <div className="admin-item-actions" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span className="muted" style={{ fontSize: 12, alignSelf: "center" }}>
                      Roles:
                    </span>
                    <label className="check-row" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={hasAdmin}
                        onChange={(e) => toggleRole(user, "admin", e.target.checked)}
                        disabled={busyId === user.id || (isSelf && hasAdmin)}
                      />
                      admin
                    </label>
                    <label className="check-row" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={hasEditor}
                        onChange={(e) => toggleRole(user, "editor", e.target.checked)}
                        disabled={busyId === user.id}
                      />
                      editor
                    </label>
                    <label className="check-row" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={hasModerator}
                        onChange={(e) => toggleRole(user, "moderator", e.target.checked)}
                        disabled={busyId === user.id}
                      />
                      moderator
                    </label>
                  </div>

                  <div className="admin-item-actions">
                    <button
                      className={isBlocked ? "button" : "button secondary"}
                      type="button"
                      onClick={() => toggleBlock(user)}
                      disabled={busyId === user.id}
                    >
                      {busyId === user.id ? "Guardando..." : isBlocked ? "Desbloquear" : "Bloquear"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => deleteUser(user)}
                      disabled={busyId === user.id || isSelf}
                    >
                      {busyId === user.id ? "Eliminando..." : isSelf ? "No puedes borrarte" : "Eliminar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </main>
  );
}
