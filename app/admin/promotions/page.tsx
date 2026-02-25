"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";
import { PROMO_TARGET_SECTIONS } from "@/lib/promoSection";

type Promotion = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_path: string | null;
  cta_label: string | null;
  cta_url: string | null;
  promo_type?: "sponsor" | "internal" | "affiliate" | null;
  target_sections?: string[] | null;
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
  const [imagePath, setImagePath] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [promoType, setPromoType] = useState<"sponsor" | "internal" | "affiliate">("sponsor");
  const [placement, setPlacement] = useState("top_banner");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [targetSections, setTargetSections] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setItems([]);
      setStatus("Sesión inválida.");
      return;
    }
    const res = await fetch("/api/admin/promotions", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok || !json?.ok) {
      setItems([]);
      setStatus(json?.error ?? `No se pudieron cargar promociones (HTTP ${res.status}).`);
      return;
    }
    setItems((json.items as Promotion[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setImageUrl("");
    setImagePath("");
    setCtaLabel("");
    setCtaUrl("");
    setPromoType("sponsor");
    setPlacement("top_banner");
    setDisplayOrder(0);
    setIsActive(true);
    setTargetSections([]);
    setStartsAt("");
    setEndsAt("");
  };

  const edit = (item: Promotion) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setImageUrl(item.image_url ?? "");
    setImagePath(item.image_path ?? "");
    setCtaLabel(item.cta_label ?? "");
    setCtaUrl(item.cta_url ?? "");
    setPromoType((item.promo_type as any) ?? "sponsor");
    setPlacement(item.placement ?? "home");
    setDisplayOrder(item.display_order ?? 0);
    setIsActive(item.is_active);
    const loaded = ((((item as any).target_sections ?? []) as any[])?.map((x) => String(x)) ?? []).filter(Boolean);
    // Back-compat: if DB has NULL/empty, treat as global.
    setTargetSections(loaded.length ? loaded : ["all"]);
    setStartsAt(item.starts_at ? new Date(item.starts_at).toISOString().slice(0, 16) : "");
    setEndsAt(item.ends_at ? new Date(item.ends_at).toISOString().slice(0, 16) : "");
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setStatus(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        toast.error("Sesión inválida. Inicia sesión como admin.");
        setStatus("Sesión inválida.");
        setUploading(false);
        return;
      }

      const form = new FormData();
      form.append("file", file);
      if (imagePath) form.append("oldPath", imagePath);

      const res = await fetch("/api/admin/promotions/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        const msg = json?.error ?? `Error subiendo imagen (HTTP ${res.status}).`;
        toast.error(msg);
        setStatus(msg);
        setUploading(false);
        return;
      }

      setImageUrl(String(json.publicUrl ?? ""));
      setImagePath(String(json.path ?? ""));
      toast.success("Imagen subida.");
      setStatus("Imagen subida.");
    } finally {
      setUploading(false);
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm("¿Eliminar esta promoción?")) return;
    setStatus(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      toast.error("Sesión inválida. Inicia sesión como admin.");
      setStatus("Sesión inválida.");
      return;
    }
    const res = await fetch(`/api/admin/promotions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      const msg = json?.error ?? `No se pudo eliminar (HTTP ${res.status}).`;
      toast.error(msg);
      setStatus(msg);
      return;
    }
    toast.success("Promoción eliminada.");
    await load();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    // Requirement: promos must include an image (logo/banner) depending on placement.
    // Internal promos can fall back to /logo.png, but sponsors/affiliates must provide an image.
    if (promoType !== "internal" && !imageUrl) {
      const msg = "Esta promoción requiere imagen (logo/banner). Sube una imagen o pega un URL.";
      toast.error(msg);
      setStatus(msg);
      return;
    }
    if (promoType !== "internal" && (targetSections.length === 0 || targetSections.includes("all"))) {
      const msg = "Sponsor/Affiliate: selecciona al menos 1 sección (para no molestar en todas).";
      toast.error(msg);
      setStatus(msg);
      return;
    }

    const normalizedSections =
      targetSections.includes("all") ? ["all"] : Array.from(new Set(targetSections.map((s) => String(s).trim()).filter(Boolean)));

    const payloadBase: any = {
      id: editingId ?? undefined,
      title,
      description: description || null,
      image_url: imageUrl || null,
      image_path: imagePath || null,
      cta_label: ctaLabel || null,
      cta_url: ctaUrl || null,
      placement,
      display_order: Number(displayOrder) || 0,
      is_active: isActive,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      updated_at: new Date().toISOString(),
      target_sections: normalizedSections.length ? normalizedSections : null
    };
    payloadBase.promo_type = promoType;

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      const msg = "Sesión inválida.";
      toast.error(msg);
      setStatus(msg);
      return;
    }

    const res = await fetch("/api/admin/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payloadBase)
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok || !json?.ok) {
      const msg = json?.error ?? `No se pudo guardar (HTTP ${res.status}).`;
      toast.error(msg);
      setStatus(msg);
      return;
    }

    if (editingId) {
      toast.success("Promoción actualizada.");
      setStatus("Promoción actualizada.");
    } else {
      toast.success("Promoción creada.");
      setStatus("Promoción creada.");
    }

    // If a promotion is turned off, remove its image from Storage and clear image fields.
    if (editingId && !isActive && imagePath) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (token) {
        await fetch("/api/admin/promotions/cleanup", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: editingId })
        }).catch(() => null);
      }
      setImageUrl("");
      setImagePath("");
    }

    reset();
    await load();
  };

  return (
    <main className="admin-promos-page">
      <header className="card admin-promos-head">
        <div>
          <h1 className="section-title admin-promos-title">Promociones / Ads</h1>
          <p className="muted admin-promos-subhead">Gestiona campañas por formato, ubicación y sección sin afectar la lectura.</p>
        </div>
      </header>

      <div className="admin-promos-layout">
        <form className="card form-stack admin-promos-form" onSubmit={submit}>
          <div className="admin-promos-section">
            <h2 className="admin-promos-block-title">Editor de promoción</h2>
            <div className="admin-promos-row">
              <label className="admin-promos-label">
                <span>Título</span>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>
              <label className="admin-promos-label">
                <span>Tipo</span>
                <select className="select" value={promoType} onChange={(e) => setPromoType(e.target.value as any)}>
                  <option value="sponsor">Sponsor</option>
                  <option value="internal">Internal (SPM)</option>
                  <option value="affiliate">Affiliate</option>
                </select>
              </label>
            </div>

            <label className="admin-promos-label">
              <span>Descripción</span>
              <textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>

          <div className="admin-promos-section">
            <h3 className="admin-promos-subtitle">Arte y CTA</h3>
            <div className="admin-promos-row">
              <label className="admin-promos-label">
                <span>Imagen (URL)</span>
                <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
              </label>
              <label className="admin-promos-label">
                <span>Subir imagen</span>
                <input
                  className="input"
                  type="file"
                  accept="image/*"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                  }}
                />
              </label>
            </div>

            {promoType !== "internal" ? (
              <p className="muted admin-promos-help">Sponsor/Affiliate: la imagen es obligatoria.</p>
            ) : (
              <p className="muted admin-promos-help">Internal: si no subes imagen, se usa el logo del sitio.</p>
            )}

            {imageUrl ? (
              <div className="admin-promos-preview" aria-hidden="true">
                <img src={imageUrl} alt="" loading="lazy" decoding="async" />
              </div>
            ) : null}

            <div className="admin-promos-row">
              <label className="admin-promos-label">
                <span>CTA label</span>
                <input className="input" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Ej: Ver oferta" />
              </label>
              <label className="admin-promos-label">
                <span>CTA URL</span>
                <input className="input" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." />
              </label>
            </div>
          </div>

          <div className="admin-promos-section">
            <h3 className="admin-promos-subtitle">Ubicación y alcance</h3>
            <div className="admin-promos-row admin-promos-row-tight">
              <label className="admin-promos-label">
                <span>Placement</span>
                <select className="select" value={placement} onChange={(e) => setPlacement(e.target.value)}>
                  <option value="top_banner">Top banner (debajo del header)</option>
                  <option value="section_header">Header de sección (slot dedicado)</option>
                  <option value="mid_content">Mid-content (artículos)</option>
                  <option value="blog_toc">Blog: debajo del índice (TOC)</option>
                  <option value="bottom_sticky">Barra inferior sticky</option>
                  <option value="popup">Popup controlado</option>
                  <option value="home">Home (sección promociones)</option>
                </select>
              </label>
              <label className="admin-promos-label admin-promos-order">
                <span>Orden</span>
                <input className="input" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} />
              </label>
            </div>

            <label className="admin-promos-label">
              <span>Secciones</span>
              <div className="check-grid admin-promos-check-grid">
                {PROMO_TARGET_SECTIONS.map((s) => (
                  <label key={s.id} className="check-row compact">
                    <input
                      type="checkbox"
                      checked={targetSections.includes(s.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setTargetSections((prev) => {
                          const next = checked ? [...prev, s.id] : prev.filter((x) => x !== s.id);
                          if (next.includes("all")) return ["all"];
                          return next.filter((x) => x !== "all");
                        });
                      }}
                    />
                    {s.label}
                  </label>
                ))}
              </div>
            </label>
            <p className="muted admin-promos-help">
              Sponsor/Affiliate: usa secciones específicas. Internal puede usar Global.
            </p>
          </div>

          <div className="admin-promos-section">
            <h3 className="admin-promos-subtitle">Programación</h3>
            <div className="admin-promos-row">
              <label className="admin-promos-label">
                <span>Inicio (opcional)</span>
                <input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </label>
              <label className="admin-promos-label">
                <span>Fin (opcional)</span>
                <input className="input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </label>
            </div>

            <label className="check-row">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Activa
            </label>
          </div>

          <div className="form-submit-bar admin-promos-submit">
            <button className="button" type="submit" disabled={uploading}>
              {uploading ? "Subiendo imagen..." : editingId ? "Actualizar promoción" : "Crear promoción"}
            </button>
            {editingId ? (
              <button className="button secondary" type="button" onClick={reset}>
                Cancelar edición
              </button>
            ) : null}
          </div>
          {status ? <p className="muted admin-promos-status">{status}</p> : null}
        </form>

        <section className="card admin-promos-list">
          <h2 className="admin-promos-block-title">Promociones cargadas</h2>
          <div className="list">
            {items.map((item) => (
              <article key={item.id} className="card admin-promos-item">
                <div className="admin-promos-item-head">
                  <div className="admin-promos-item-thumb">
                    <img src={item.image_url ?? "/logo.png"} alt="" width={54} height={54} loading="lazy" decoding="async" />
                  </div>
                  <div className="admin-promos-item-copy">
                    <strong>{item.title}</strong>
                    <span className="muted">
                      {(item.promo_type ?? "sponsor").toUpperCase()} · {item.placement} · order {item.display_order} ·{" "}
                      {item.is_active ? "activa" : "inactiva"}
                    </span>
                    <span className="muted">
                      Secciones:{" "}
                      {(() => {
                        const ts = ((item as any).target_sections ?? []) as any[];
                        if (!Array.isArray(ts) || ts.length === 0) return "global";
                        const lower = ts.map((x) => String(x).toLowerCase());
                        if (lower.includes("all")) return "global";
                        return ts.join(", ");
                      })()}
                    </span>
                  </div>
                </div>
                <div className="admin-item-actions">
                  <button className="button secondary" type="button" onClick={() => edit(item)}>
                    Editar
                  </button>
                  <button className="button secondary" type="button" onClick={() => deletePromotion(item.id)}>
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
            {items.length === 0 ? <p className="muted">No hay promociones.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
