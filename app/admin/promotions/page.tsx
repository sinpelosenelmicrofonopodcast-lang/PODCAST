"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

type Promotion = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  placement: string;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export default function AdminPromotionsPage() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [placement, setPlacement] = useState("home");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("promotions")
      .select("id, title, description, image_url, cta_label, cta_url, placement, display_order, is_active, starts_at, ends_at")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    setItems((data as Promotion[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setImageUrl("");
    setCtaLabel("");
    setCtaUrl("");
    setPlacement("home");
    setDisplayOrder(0);
    setIsActive(true);
    setStartsAt("");
    setEndsAt("");
  };

  const edit = (item: Promotion) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setImageUrl(item.image_url ?? "");
    setCtaLabel(item.cta_label ?? "");
    setCtaUrl(item.cta_url ?? "");
    setPlacement(item.placement ?? "home");
    setDisplayOrder(item.display_order ?? 0);
    setIsActive(item.is_active);
    setStartsAt(item.starts_at ? new Date(item.starts_at).toISOString().slice(0, 16) : "");
    setEndsAt(item.ends_at ? new Date(item.ends_at).toISOString().slice(0, 16) : "");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    const payload = {
      title,
      description: description || null,
      image_url: imageUrl || null,
      cta_label: ctaLabel || null,
      cta_url: ctaUrl || null,
      placement,
      display_order: Number(displayOrder) || 0,
      is_active: isActive,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      updated_at: new Date().toISOString()
    };
    if (editingId) {
      const { error } = await supabase.from("promotions").update(payload).eq("id", editingId);
      if (error) return setStatus(error.message);
      setStatus("Promoción actualizada.");
    } else {
      const { error } = await supabase.from("promotions").insert(payload);
      if (error) return setStatus(error.message);
      setStatus("Promoción creada.");
    }
    reset();
    await load();
  };

  return (
    <main>
      <h1 className="section-title">Promociones / Ads</h1>
      <p className="muted">Gestiona anuncios de marcas visibles en home.</p>
      <form className="card form-stack" onSubmit={submit} style={{ marginTop: 20 }}>
        <label>
          Título
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Descripción
          <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Imagen (URL)
          <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </label>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            CTA label
            <input className="input" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Ej: Ver oferta" />
          </label>
          <label>
            CTA URL
            <input className="input" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." />
          </label>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Placement
            <select className="select" value={placement} onChange={(e) => setPlacement(e.target.value)}>
              <option value="home">Home</option>
              <option value="home_hero">Home Hero</option>
              <option value="home_mid">Home Mid</option>
              <option value="toast">Popup (abajo)</option>
            </select>
          </label>
          <label>
            Orden
            <input className="input" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} />
          </label>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Inicio (opcional)
            <input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </label>
          <label>
            Fin (opcional)
            <input className="input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </label>
        </div>
        <label className="check-row">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Activa
        </label>
        <div className="form-submit-bar">
          <button className="button" type="submit">
            {editingId ? "Actualizar promoción" : "Crear promoción"}
          </button>
          {editingId ? (
            <button className="button secondary" type="button" onClick={reset}>
              Cancelar edición
            </button>
          ) : null}
        </div>
        {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
      </form>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Promociones cargadas</h3>
        <div className="list" style={{ marginTop: 12 }}>
          {items.map((item) => (
            <div key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
              <strong>{item.title}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                {item.placement} · order {item.display_order} · {item.is_active ? "activa" : "inactiva"}
              </span>
              <div className="admin-item-actions">
                <button className="button secondary" type="button" onClick={() => edit(item)}>
                  Editar
                </button>
                <AdminDeleteButton table="promotions" id={item.id} label="Eliminar" />
              </div>
            </div>
          ))}
          {items.length === 0 ? <p className="muted">No hay promociones.</p> : null}
        </div>
      </div>
    </main>
  );
}
