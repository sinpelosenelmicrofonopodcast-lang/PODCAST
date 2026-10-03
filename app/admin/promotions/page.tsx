"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
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
  campaign_id?: string | null;
  advertiser?: string | null;
  creative_id?: string | null;
  weight?: number | null;
  frequency_cap?: number | null;
  max_impressions?: number | null;
  daily_cap?: number | null;
  target_region?: string | null;
  device_target?: string | null;
  revenue_cents?: number | null;
};

const PLACEMENTS = [
  ["top_banner", "Top banner · header"],
  ["home_featured", "Homepage · Featured Sponsor"],
  ["home_mid", "Homepage · Mid feed"],
  ["section_header", "Section Sponsor · header de sección"],
  ["mid_content", "Article Inline · primer bloque"],
  ["article_inline_2", "Article Inline · segundo bloque"],
  ["side_sticky", "Desktop Side Sticky · 300×600"],
  ["podcast_sponsor", "Podcast Sponsor"],
  ["community_partner", "Community Partner"],
  ["blog_toc", "Blog · debajo del índice"],
  ["bottom_sticky", "Barra inferior sticky"],
  ["popup", "Popup controlado"],
  ["home", "Legacy home"],
] as const;

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function dollarsToCents(value: string) {
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

export default function AdminPromotionsPage() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const [campaignId, setCampaignId] = useState("");
  const [advertiser, setAdvertiser] = useState("");
  const [creativeId, setCreativeId] = useState("");
  const [weight, setWeight] = useState(100);
  const [frequencyCap, setFrequencyCap] = useState("");
  const [maxImpressions, setMaxImpressions] = useState("");
  const [dailyCap, setDailyCap] = useState("");
  const [targetRegion, setTargetRegion] = useState("");
  const [deviceTarget, setDeviceTarget] = useState("all");
  const [revenue, setRevenue] = useState("0");

  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  const load = async () => {
    const token = await getToken();
    if (!token) {
      setItems([]);
      setStatus("Sesión inválida.");
      return;
    }
    const res = await fetch("/api/admin/promotions", { headers: { Authorization: `Bearer ${token}` } });
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
    setCampaignId("");
    setAdvertiser("");
    setCreativeId("");
    setWeight(100);
    setFrequencyCap("");
    setMaxImpressions("");
    setDailyCap("");
    setTargetRegion("");
    setDeviceTarget("all");
    setRevenue("0");
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
    setPlacement(item.placement ?? "top_banner");
    setDisplayOrder(item.display_order ?? 0);
    setIsActive(item.is_active);
    const loaded = (item.target_sections ?? []).map(String).filter(Boolean);
    setTargetSections(loaded.length ? loaded : ["all"]);
    setStartsAt(toLocalInput(item.starts_at));
    setEndsAt(toLocalInput(item.ends_at));
    setCampaignId(item.campaign_id ?? "");
    setAdvertiser(item.advertiser ?? "");
    setCreativeId(item.creative_id ?? "");
    setWeight(item.weight ?? 100);
    setFrequencyCap(item.frequency_cap ? String(item.frequency_cap) : "");
    setMaxImpressions(item.max_impressions ? String(item.max_impressions) : "");
    setDailyCap(item.daily_cap ? String(item.daily_cap) : "");
    setTargetRegion(item.target_region ?? "");
    setDeviceTarget(item.device_target ?? "all");
    setRevenue(((item.revenue_cents ?? 0) / 100).toFixed(2));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setStatus(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Sesión inválida. Inicia sesión como admin.");
      const form = new FormData();
      form.append("file", file);
      if (imagePath) form.append("oldPath", imagePath);
      const res = await fetch("/api/admin/promotions/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) throw new Error(json?.error ?? `Error subiendo imagen (HTTP ${res.status}).`);
      setImageUrl(String(json.publicUrl ?? ""));
      setImagePath(String(json.path ?? ""));
      toast.success("Imagen subida.");
      setStatus("Imagen subida.");
    } catch (error: any) {
      const message = error?.message ?? "No se pudo subir la imagen.";
      toast.error(message);
      setStatus(message);
    } finally {
      setUploading(false);
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm("¿Eliminar esta promoción?")) return;
    const token = await getToken();
    if (!token) return setStatus("Sesión inválida.");
    const res = await fetch(`/api/admin/promotions/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.ok) {
      const message = json?.error ?? `No se pudo eliminar (HTTP ${res.status}).`;
      toast.error(message);
      setStatus(message);
      return;
    }
    toast.success("Promoción eliminada.");
    await load();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (promoType !== "internal" && !imageUrl) {
      const message = "Sponsor/Affiliate requiere una imagen.";
      toast.error(message);
      return setStatus(message);
    }
    if (promoType !== "internal" && (targetSections.length === 0 || targetSections.includes("all"))) {
      const message = "Sponsor/Affiliate debe apuntar a por lo menos una sección específica.";
      toast.error(message);
      return setStatus(message);
    }

    const token = await getToken();
    if (!token) return setStatus("Sesión inválida.");
    const normalizedSections = targetSections.includes("all")
      ? ["all"]
      : Array.from(new Set(targetSections.map((s) => String(s).trim()).filter(Boolean)));

    const payload = {
      id: editingId ?? undefined,
      title,
      description: description || null,
      image_url: imageUrl || null,
      image_path: imagePath || null,
      cta_label: ctaLabel || null,
      cta_url: ctaUrl || null,
      promo_type: promoType,
      placement,
      display_order: Number(displayOrder) || 0,
      is_active: isActive,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
      updated_at: new Date().toISOString(),
      target_sections: normalizedSections.length ? normalizedSections : null,
      campaign_id: campaignId || null,
      advertiser: advertiser || null,
      creative_id: creativeId || null,
      weight: Math.max(1, Number(weight) || 100),
      frequency_cap: frequencyCap ? Number(frequencyCap) : null,
      max_impressions: maxImpressions ? Number(maxImpressions) : null,
      daily_cap: dailyCap ? Number(dailyCap) : null,
      target_region: targetRegion || null,
      device_target: deviceTarget,
      revenue_cents: dollarsToCents(revenue),
    };

    const res = await fetch("/api/admin/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({} as any));
    if (!res.ok || !json?.ok) {
      const message = json?.error ?? `No se pudo guardar (HTTP ${res.status}).`;
      toast.error(message);
      return setStatus(message);
    }

    toast.success(editingId ? "Campaña actualizada." : "Campaña creada.");
    setStatus(editingId ? "Campaña actualizada." : "Campaña creada.");
    reset();
    await load();
  };

  return (
    <main className="admin-promos-page">
      <header className="card admin-promos-head">
        <div>
          <p className="page-kicker">AD SERVER · SIN PELOS</p>
          <h1 className="section-title admin-promos-title">Campañas / Sponsors</h1>
          <p className="muted admin-promos-subhead">Inventario, targeting, rotación, caps y revenue en un solo lugar.</p>
        </div>
        <div className="admin-item-actions">
          <Link className="button secondary" href="/admin/promotions/report">Ver reporte</Link>
          {editingId ? <button className="button secondary" type="button" onClick={reset}>Nueva campaña</button> : null}
        </div>
      </header>

      <div className="admin-promos-layout">
        <form className="card form-stack admin-promos-form" onSubmit={submit}>
          <div className="admin-promos-section">
            <h2 className="admin-promos-block-title">Identidad comercial</h2>
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>Advertiser</span><input className="input" value={advertiser} onChange={(e) => setAdvertiser(e.target.value)} placeholder="Ej: Diamond Studio" /></label>
              <label className="admin-promos-label"><span>Campaign ID</span><input className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="Ej: diamond-q4-2026" /></label>
            </div>
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>Creative ID</span><input className="input" value={creativeId} onChange={(e) => setCreativeId(e.target.value)} placeholder="Ej: top-banner-v2" /></label>
              <label className="admin-promos-label"><span>Revenue contratado ($)</span><input className="input" inputMode="decimal" value={revenue} onChange={(e) => setRevenue(e.target.value)} /></label>
            </div>
          </div>

          <div className="admin-promos-section">
            <h2 className="admin-promos-block-title">Creativo</h2>
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>Título</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></label>
              <label className="admin-promos-label">
                <span>Tipo</span>
                <select className="select" value={promoType} onChange={(e) => setPromoType(e.target.value as any)}>
                  <option value="sponsor">Sponsor</option><option value="internal">Internal SPM</option><option value="affiliate">Affiliate</option>
                </select>
              </label>
            </div>
            <label className="admin-promos-label"><span>Descripción</span><textarea className="textarea" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>Imagen (URL)</span><input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." /></label>
              <label className="admin-promos-label"><span>Subir imagen</span><input className="input" type="file" accept="image/*" disabled={uploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); }} /></label>
            </div>
            {imageUrl ? <div className="admin-promos-preview"><img src={imageUrl} alt="Preview del creativo" loading="lazy" decoding="async" /></div> : null}
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>CTA</span><input className="input" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Ver oferta" /></label>
              <label className="admin-promos-label"><span>CTA URL</span><input className="input" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." /></label>
            </div>
          </div>

          <div className="admin-promos-section">
            <h3 className="admin-promos-subtitle">Ubicación y targeting</h3>
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>Placement</span><select className="select" value={placement} onChange={(e) => setPlacement(e.target.value)}>{PLACEMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="admin-promos-label"><span>Prioridad</span><input className="input" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(Number(e.target.value))} /><small className="muted">0 corre primero; el peso decide la rotación entre iguales.</small></label>
            </div>
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>Dispositivo</span><select className="select" value={deviceTarget} onChange={(e) => setDeviceTarget(e.target.value)}><option value="all">Todos</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option></select></label>
              <label className="admin-promos-label"><span>Región opcional</span><input className="input" value={targetRegion} onChange={(e) => setTargetRegion(e.target.value)} placeholder="Ej: TX, PR" /><small className="muted">Vacío = cualquier región.</small></label>
            </div>
            <label className="admin-promos-label"><span>Secciones</span><div className="check-grid admin-promos-check-grid">{PROMO_TARGET_SECTIONS.map((s) => <label key={s.id} className="check-row compact"><input type="checkbox" checked={targetSections.includes(s.id)} onChange={(e) => setTargetSections((prev) => { if (s.id === "all") return e.target.checked ? ["all"] : []; const withoutAll = prev.filter((x) => x !== "all"); return e.target.checked ? Array.from(new Set([...withoutAll, s.id])) : withoutAll.filter((x) => x !== s.id); })} />{s.label}</label>)}</div></label>
          </div>

          <div className="admin-promos-section">
            <h3 className="admin-promos-subtitle">Rotación y límites</h3>
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>Peso</span><input className="input" type="number" min={1} value={weight} onChange={(e) => setWeight(Number(e.target.value))} /><small className="muted">Ej: 50 vs 30 vs 20.</small></label>
              <label className="admin-promos-label"><span>Frequency cap / sesión</span><input className="input" type="number" min={1} value={frequencyCap} onChange={(e) => setFrequencyCap(e.target.value)} placeholder="Vacío = sin límite" /></label>
            </div>
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>Máximo total de impresiones</span><input className="input" type="number" min={1} value={maxImpressions} onChange={(e) => setMaxImpressions(e.target.value)} placeholder="Vacío = sin límite" /></label>
              <label className="admin-promos-label"><span>Máximo diario</span><input className="input" type="number" min={1} value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} placeholder="Vacío = sin límite" /></label>
            </div>
          </div>

          <div className="admin-promos-section">
            <h3 className="admin-promos-subtitle">Programación</h3>
            <div className="admin-promos-row">
              <label className="admin-promos-label"><span>Inicio</span><input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
              <label className="admin-promos-label"><span>Fin</span><input className="input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
            </div>
            <label className="check-row"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />Campaña activa</label>
          </div>

          <div className="form-submit-bar admin-promos-submit">
            <button className="button" type="submit" disabled={uploading}>{uploading ? "Subiendo..." : editingId ? "Actualizar campaña" : "Crear campaña"}</button>
            {editingId ? <button className="button secondary" type="button" onClick={reset}>Cancelar edición</button> : null}
          </div>
          {status ? <p className="muted admin-promos-status">{status}</p> : null}
        </form>

        <section className="card admin-promos-list">
          <div className="admin-promos-item-head"><h2 className="admin-promos-block-title">Campañas cargadas</h2><span className="badge">{items.length}</span></div>
          <div className="list">
            {items.map((item) => (
              <article key={item.id} className="card admin-promos-item">
                <div className="admin-promos-item-head">
                  <div className="admin-promos-item-thumb"><img src={item.image_url ?? "/logo.png"} alt="" width={54} height={54} loading="lazy" decoding="async" /></div>
                  <div className="admin-promos-item-copy">
                    <strong>{item.title}</strong>
                    <span className="muted">{item.advertiser || "Sin advertiser"} · {item.placement} · {item.is_active ? "ACTIVA" : "INACTIVA"}</span>
                    <span className="muted">Peso {item.weight ?? 100} · Cap sesión {item.frequency_cap ?? "∞"} · Diario {item.daily_cap ?? "∞"} · Total {item.max_impressions ?? "∞"}</span>
                    <span className="muted">Campaign: {item.campaign_id || "—"} · Creative: {item.creative_id || "—"} · Revenue: ${((item.revenue_cents ?? 0) / 100).toFixed(2)}</span>
                    <span className="muted">Secciones: {item.target_sections?.length ? item.target_sections.join(", ") : "global"} · Device: {item.device_target || "all"}{item.target_region ? ` · Región: ${item.target_region}` : ""}</span>
                  </div>
                </div>
                <div className="admin-item-actions"><button className="button secondary" type="button" onClick={() => edit(item)}>Editar</button><button className="button secondary" type="button" onClick={() => deletePromotion(item.id)}>Eliminar</button></div>
              </article>
            ))}
            {items.length === 0 ? <p className="muted">No hay campañas.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
