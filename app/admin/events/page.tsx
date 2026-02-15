"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

type EventItem = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  visibility: string;
  join_url: string | null;
};

export default function AdminEventsPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [joinUrl, setJoinUrl] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [items, setItems] = useState<EventItem[]>([]);

  const load = async () => {
    const { data } = await supabase
      .from("live_events")
      .select("id, title, description, starts_at, ends_at, visibility, join_url")
      .order("starts_at", { ascending: true });
    setItems((data as EventItem[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setJoinUrl("");
    setVisibility("public");
    setEditingId(null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    const payload = {
      title,
      description,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      join_url: joinUrl || null,
      visibility
    };
    if (editingId) {
      const { error } = await supabase.from("live_events").update(payload).eq("id", editingId);
      if (error) return setStatus(error.message);
      setStatus("Evento actualizado.");
    } else {
      const { error } = await supabase.from("live_events").insert(payload);
      if (error) return setStatus(error.message);
      setStatus("Evento creado.");
    }
    resetForm();
    await load();
  };

  const edit = (item: EventItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setStartsAt(item.starts_at ? new Date(item.starts_at).toISOString().slice(0, 16) : "");
    setEndsAt(item.ends_at ? new Date(item.ends_at).toISOString().slice(0, 16) : "");
    setJoinUrl(item.join_url ?? "");
    setVisibility(item.visibility ?? "public");
  };

  return (
    <main>
      <h1 className="section-title">Eventos (Admin)</h1>
      <p className="muted">Crear, editar y eliminar próximos eventos en vivo.</p>

      <form className="card form-stack" onSubmit={submit} style={{ marginTop: 20 }}>
        <label>
          Título
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Descripción
          <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Inicio
            <input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label>
            Fin
            <input className="input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </div>
        <label>
          Link de evento (Zoom/Stream)
          <input className="input" value={joinUrl} onChange={(e) => setJoinUrl(e.target.value)} placeholder="https://..." />
        </label>
        <label>
          Visibilidad
          <select className="select" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="public">Public</option>
            <option value="members">Members</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <div className="form-submit-bar">
          <button className="button" type="submit">
            {editingId ? "Actualizar evento" : "Crear evento"}
          </button>
          {editingId ? (
            <button className="button secondary" type="button" onClick={resetForm}>
              Cancelar edición
            </button>
          ) : null}
        </div>
        {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
      </form>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Eventos cargados</h3>
        <div className="list" style={{ marginTop: 12 }}>
          {items.map((item) => (
            <div key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
              <strong>{item.title}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                {item.starts_at ? new Date(item.starts_at).toLocaleString("es-PR") : "Sin fecha"} · {item.visibility}
              </span>
              <div className="admin-item-actions">
                <button className="button secondary" type="button" onClick={() => edit(item)}>
                  Editar
                </button>
                <AdminDeleteButton table="live_events" id={item.id} label="Eliminar" />
              </div>
            </div>
          ))}
          {items.length === 0 ? <p className="muted">No hay eventos aún.</p> : null}
        </div>
      </div>
    </main>
  );
}

