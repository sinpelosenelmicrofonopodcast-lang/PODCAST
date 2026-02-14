"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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

const statuses: GuestRequestStatus[] = ["new", "contacted", "closed"];

export default function AdminGuestRequestsPage() {
  const [items, setItems] = useState<GuestRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<GuestRequestStatus | "all">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    if (activeFilter === "all") return items;
    return items.filter((item) => item.status === activeFilter);
  }, [items, activeFilter]);

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

  return (
    <main>
      <h1 className="section-title">Solicitudes de invitados</h1>
      <p className="muted">Gestiona quién quiere salir en Sin Pelos y su estado de contacto.</p>

      <div className="card" style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className={`news-tab ${activeFilter === "all" ? "active" : ""}`} onClick={() => setActiveFilter("all")} type="button">
          Todos ({items.length})
        </button>
        {statuses.map((status) => (
          <button
            key={status}
            className={`news-tab ${activeFilter === status ? "active" : ""}`}
            onClick={() => setActiveFilter(status)}
            type="button"
          >
            {status} ({items.filter((item) => item.status === status).length})
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
              <span className="news-badge">{item.status}</span>
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
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}

