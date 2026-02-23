"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type NewsSource = {
  id: string;
  name: string;
  rss_url: string;
  region: string | null;
  default_categories: string[] | null;
  is_active: boolean;
  auto_publish: boolean;
  auto_post_facebook: boolean;
  max_items_per_run: number;
  scan_every_min: number;
  trust_score: number;
  last_scanned_at: string | null;
  created_at: string;
  updated_at: string;
};

type SourceForm = {
  name: string;
  rss_url: string;
  region: string;
  default_categories: string;
  auto_publish: boolean;
  auto_post_facebook: boolean;
  max_items_per_run: number;
  scan_every_min: number;
  trust_score: number;
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-PR");
}

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

const EMPTY_FORM: SourceForm = {
  name: "",
  rss_url: "",
  region: "",
  default_categories: "",
  auto_publish: true,
  auto_post_facebook: false,
  max_items_per_run: 12,
  scan_every_min: 15,
  trust_score: 60
};

export default function AdminNewsSourcesPage() {
  const [items, setItems] = useState<NewsSource[]>([]);
  const [form, setForm] = useState<SourceForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    setStatus(null);
    const token = await getToken();
    if (!token) {
      setLoading(false);
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }

    const res = await fetch("/api/admin/news-sources", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setStatus(json?.error ?? "No se pudo cargar fuentes RSS.");
      return;
    }
    setItems((json?.items as NewsSource[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((s) => {
      return (
        s.name.toLowerCase().includes(term) ||
        s.rss_url.toLowerCase().includes(term) ||
        String(s.region ?? "")
          .toLowerCase()
          .includes(term)
      );
    });
  }, [items, q]);

  const createSource = async () => {
    setSaving(true);
    setStatus(null);
    const token = await getToken();
    if (!token) {
      setSaving(false);
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }

    const categories = form.default_categories
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const payload = {
      name: form.name,
      rss_url: form.rss_url,
      region: form.region.trim() || null,
      default_categories: categories,
      auto_publish: form.auto_publish,
      auto_post_facebook: form.auto_post_facebook,
      max_items_per_run: form.max_items_per_run,
      scan_every_min: form.scan_every_min,
      trust_score: form.trust_score
    };

    const res = await fetch("/api/admin/news-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setStatus(json?.error ?? "No se pudo crear la fuente.");
      return;
    }

    setForm(EMPTY_FORM);
    setStatus("Fuente creada.");
    await load();
  };

  const patchSource = async (id: string, patch: Record<string, any>) => {
    setBusyId(id);
    setStatus(null);
    const token = await getToken();
    if (!token) {
      setBusyId(null);
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return false;
    }
    const res = await fetch(`/api/admin/news-sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(patch)
    });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setStatus(json?.error ?? "No se pudo actualizar la fuente.");
      return false;
    }
    return true;
  };

  const removeSource = async (id: string, name: string) => {
    if (!window.confirm(`Eliminar fuente "${name}"?`)) return;
    setBusyId(id);
    setStatus(null);
    const token = await getToken();
    if (!token) {
      setBusyId(null);
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }
    const res = await fetch(`/api/admin/news-sources/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });
    const json = await res.json().catch(() => ({}));
    setBusyId(null);
    if (!res.ok) {
      setStatus(json?.error ?? "No se pudo eliminar la fuente.");
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  const runTask = async (task: "ingest" | "process") => {
    setStatus(null);
    const token = await getToken();
    if (!token) {
      setStatus("Sesión inválida. Vuelve a iniciar sesión.");
      return;
    }
    const res = await fetch("/api/admin/news-automation/run", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ task })
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(json?.error ?? `No se pudo ejecutar ${task}.`);
      return;
    }
    setStatus(task === "ingest" ? "Ingesta ejecutada." : "Worker de cola ejecutado.");
    await load();
  };

  return (
    <main>
      <h1 className="section-title">Fuentes RSS (Noticias Automáticas)</h1>
      <p className="muted">Gestiona fuentes, auto-publicación y posteo social por fuente.</p>

      {status ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        </div>
      ) : null}

      <div className="card form-stack" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Nueva fuente</h3>
        <label>
          Nombre
          <input className="input" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </label>
        <label>
          RSS URL
          <input className="input" value={form.rss_url} onChange={(e) => setForm((p) => ({ ...p, rss_url: e.target.value }))} />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          <label>
            Región
            <input className="input" value={form.region} onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))} placeholder="PR / TX / USA / Mundo" />
          </label>
          <label>
            Categorías por defecto (coma)
            <input
              className="input"
              value={form.default_categories}
              onChange={(e) => setForm((p) => ({ ...p, default_categories: e.target.value }))}
              placeholder="PR, Política"
            />
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <label>
            Max items/run
            <input
              className="input"
              type="number"
              min={1}
              max={50}
              value={form.max_items_per_run}
              onChange={(e) => setForm((p) => ({ ...p, max_items_per_run: Number(e.target.value) || 12 }))}
            />
          </label>
          <label>
            Scan cada (min)
            <input
              className="input"
              type="number"
              min={5}
              max={1440}
              value={form.scan_every_min}
              onChange={(e) => setForm((p) => ({ ...p, scan_every_min: Number(e.target.value) || 15 }))}
            />
          </label>
          <label>
            Trust score
            <input
              className="input"
              type="number"
              min={0}
              max={100}
              value={form.trust_score}
              onChange={(e) => setForm((p) => ({ ...p, trust_score: Number(e.target.value) || 60 }))}
            />
          </label>
        </div>
        <div className="check-grid">
          <label className="check-row compact">
            <input type="checkbox" checked={form.auto_publish} onChange={(e) => setForm((p) => ({ ...p, auto_publish: e.target.checked }))} />
            Auto publicar
          </label>
          <label className="check-row compact">
            <input
              type="checkbox"
              checked={form.auto_post_facebook}
              onChange={(e) => setForm((p) => ({ ...p, auto_post_facebook: e.target.checked }))}
            />
            Auto post Facebook
          </label>
        </div>
        <div className="form-submit-bar">
          <button className="button" type="button" disabled={saving} onClick={createSource}>
            {saving ? "Guardando..." : "Crear fuente"}
          </button>
          <button className="button secondary" type="button" onClick={() => runTask("ingest")}>
            Ejecutar ingesta ahora
          </button>
          <button className="button secondary" type="button" onClick={() => runTask("process")}>
            Procesar cola ahora
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20, display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          Buscar fuente
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="nombre, rss, región" />
        </label>
        <button className="button secondary" type="button" onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        {loading ? <p className="muted">Cargando fuentes...</p> : null}
        {!loading && filtered.length === 0 ? <p className="muted">No hay fuentes.</p> : null}
        {!loading && filtered.length > 0 ? (
          <div className="list">
            {filtered.map((item) => (
              <div key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong>{item.name}</strong>
                  <span className="news-badge">{item.is_active ? "ACTIVA" : "INACTIVA"}</span>
                </div>
                <a href={item.rss_url} target="_blank" rel="noreferrer" className="muted" style={{ wordBreak: "break-all", fontSize: 13 }}>
                  {item.rss_url}
                </a>
                <div className="muted" style={{ fontSize: 13, display: "grid", gap: 4 }}>
                  <span>Región: {item.region ?? "—"}</span>
                  <span>Categorías: {(item.default_categories ?? []).join(", ") || "—"}</span>
                  <span>
                    Auto publicar: {item.auto_publish ? "Sí" : "No"} · Auto FB: {item.auto_post_facebook ? "Sí" : "No"}
                  </span>
                  <span>
                    Max/run: {item.max_items_per_run} · Scan: {item.scan_every_min} min · Trust: {item.trust_score}
                  </span>
                  <span>Último escaneo: {fmtDate(item.last_scanned_at)}</span>
                </div>

                <div className="admin-item-actions">
                  <button
                    className="button secondary"
                    type="button"
                    disabled={busyId === item.id}
                    onClick={async () => {
                      const ok = await patchSource(item.id, { is_active: !item.is_active });
                      if (ok) setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, is_active: !x.is_active } : x)));
                    }}
                  >
                    {busyId === item.id ? "Guardando..." : item.is_active ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={busyId === item.id}
                    onClick={async () => {
                      const ok = await patchSource(item.id, { auto_publish: !item.auto_publish });
                      if (ok) setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, auto_publish: !x.auto_publish } : x)));
                    }}
                  >
                    {item.auto_publish ? "Quitar auto-publish" : "Activar auto-publish"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={busyId === item.id}
                    onClick={async () => {
                      const ok = await patchSource(item.id, { auto_post_facebook: !item.auto_post_facebook });
                      if (ok) {
                        setItems((prev) =>
                          prev.map((x) => (x.id === item.id ? { ...x, auto_post_facebook: !x.auto_post_facebook } : x))
                        );
                      }
                    }}
                  >
                    {item.auto_post_facebook ? "Quitar auto-FB" : "Activar auto-FB"}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => removeSource(item.id, item.name)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </main>
  );
}
