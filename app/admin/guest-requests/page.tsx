"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";

type GuestRequestStatus = "new" | "contacted" | "closed";

type GuestRequest = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  availability: string;
  topic: string;
  details: string | null;
  social_url: string | null;
  status: GuestRequestStatus;
  created_at: string;
};

type GuestRequestView = GuestRequest & {
  duplicate_count: number;
};

const statuses: GuestRequestStatus[] = ["new", "contacted", "closed"];

function norm(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function fingerprint(item: GuestRequest) {
  return [
    norm(item.email),
    norm(item.full_name),
    norm(item.topic),
    norm(item.availability),
    norm(item.details),
    norm(item.phone)
  ].join("|");
}

export default function AdminGuestRequestsPage() {
  const [items, setItems] = useState<GuestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<GuestRequestStatus | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("guest_requests")
      .select("id, full_name, email, phone, availability, topic, details, social_url, status, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      setStatusMessage(error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    setItems((data as GuestRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const deduped = useMemo<GuestRequestView[]>(() => {
    const byKey = new Map<string, GuestRequestView>();
    for (const item of items) {
      const key = fingerprint(item);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, { ...item, duplicate_count: 1 });
        continue;
      }
      existing.duplicate_count += 1;
      if (new Date(item.created_at).getTime() > new Date(existing.created_at).getTime()) {
        byKey.set(key, { ...item, duplicate_count: existing.duplicate_count });
      }
    }
    return Array.from(byKey.values()).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [items]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return deduped;
    return deduped.filter((item) => item.status === activeFilter);
  }, [deduped, activeFilter]);

  const changeStatus = async (id: string, nextStatus: GuestRequestStatus) => {
    setUpdatingId(id);
    setStatusMessage(null);
    const { error } = await supabase.from("guest_requests").update({ status: nextStatus }).eq("id", id);
    setUpdatingId(null);
    if (error) {
      setStatusMessage(error.message);
      return;
    }
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));
  };

  const deleteRequest = async (item: GuestRequestView) => {
    const key = fingerprint(item);
    const duplicateIds = items.filter((x) => fingerprint(x) === key).map((x) => x.id);
    const total = duplicateIds.length;
    const confirmText =
      total > 1
        ? `¿Eliminar esta solicitud y sus ${total - 1} duplicadas?`
        : "¿Eliminar esta solicitud de invitado?";
    if (!window.confirm(confirmText)) return;

    setDeletingId(item.id);
    setStatusMessage(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "No hay sesión activa de admin.";
      setStatusMessage(msg);
      toast.error(msg);
      setDeletingId(null);
      return;
    }

    const results = await Promise.all(
      duplicateIds.map(async (id) => {
        const res = await fetch("/api/admin/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ table: "guest_requests", id })
        });
        const json = await res.json().catch(() => ({}));
        return { ok: res.ok && json?.ok, error: json?.error as string | undefined, id };
      })
    );

    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      const msg = failed[0].error ?? "No se pudieron eliminar una o más solicitudes.";
      setStatusMessage(msg);
      toast.error(msg);
      setDeletingId(null);
      return;
    }

    setItems((prev) => prev.filter((x) => !duplicateIds.includes(x.id)));
    const msg = total > 1 ? `Se eliminaron ${total} solicitudes.` : "Solicitud eliminada.";
    setStatusMessage(msg);
    toast.success(msg);
    setDeletingId(null);
  };

  return (
    <main>
      <h1 className="section-title">Solicitudes de invitados</h1>
      <p className="muted">Gestiona quién quiere salir en Sin Pelos y su estado de contacto.</p>

      <div className="card" style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className={`news-tab ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter("all")} type="button">
          Todos ({deduped.length})
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            className={`news-tab ${activeFilter === status ? "active" : ""}`}
            onClick={() => setActiveFilter(status)}
            type="button"
          >
            {status} ({deduped.filter((item) => item.status === status).length})
          </button>
        ))}
      </div>

      {statusMessage ? (
        <p className="muted" style={{ color: "var(--danger)", marginTop: 12 }}>
          {statusMessage}
        </p>
      ) : null}

      <div className="list" style={{ marginTop: 16 }}>
        {loading ? <p className="muted">Cargando solicitudes...</p> : null}
        {!loading && filtered.length === 0 ? <p className="muted">No hay solicitudes en este estado.</p> : null}
        {filtered.map((item) => (
          <article key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <strong>{item.full_name}</strong>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {item.duplicate_count > 1 ? <span className="news-badge">x{item.duplicate_count} repetidas</span> : null}
                <span className="news-badge">{item.status}</span>
              </div>
            </div>

            <div className="muted" style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <span>Email: {item.email}</span>
              {item.phone ? <span>Tel/WhatsApp: {item.phone}</span> : null}
              <span>Disponibilidad: {item.availability}</span>
              <span>Tema: {item.topic}</span>
              {item.social_url ? (
                <a href={item.social_url} target="_blank" rel="noreferrer">
                  Ver referencia social
                </a>
              ) : null}
              <span>Recibido: {new Date(item.created_at).toLocaleString("es-PR")}</span>
            </div>

            {item.details ? (
              <div className="card" style={{ background: "rgba(255,255,255,0.02)", boxShadow: "none", padding: 12 }}>
                <p style={{ margin: 0 }}>{item.details}</p>
              </div>
            ) : null}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {statuses.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={status === item.status ? "button" : "button secondary"}
                  disabled={updatingId === item.id || status === item.status}
                  onClick={() => changeStatus(item.id, status)}
                >
                  {updatingId === item.id && status !== item.status ? "Actualizando..." : status}
                </button>
              ))}
              <button
                type="button"
                className="button secondary"
                disabled={deletingId === item.id}
                onClick={() => deleteRequest(item)}
              >
                {deletingId === item.id ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
