"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { authApiRequest } from "@/lib/clientApi";
import { cleanNewsCategories } from "@/lib/newsCategories";
import { newsHref } from "@/lib/newsRoute";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { toast } from "@/lib/toast";

type NewsItem = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string | null;
  analysis: string | null;
  source_url: string | null;
  cover_url: string | null;
  video_url?: string | null;
  categories: string[] | null;
  tags: string[] | null;
  publication_state?: "draft" | "published" | null;
  published_at: string | null;
  updated_at?: string | null;
};

type EditState = {
  id: string;
  title: string;
  summary: string;
  analysis: string;
  sourceUrl: string;
  coverUrl: string;
  videoUrl: string;
  categories: string;
  tags: string;
  publicationState: "draft" | "published";
};

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-PR");
}

function toEditState(item: NewsItem): EditState {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary ?? "",
    analysis: item.analysis ?? "",
    sourceUrl: item.source_url ?? "",
    coverUrl: item.cover_url ?? "",
    videoUrl: item.video_url ?? "",
    categories: cleanNewsCategories(item.categories).join(", "),
    tags: (item.tags ?? []).join(", "),
    publicationState: item.publication_state === "draft" ? "draft" : "published"
  };
}

export default function AdminNewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    setStatus(null);

    const primary = await supabase
      .from("news_items")
      .select("id, slug, title, summary, analysis, source_url, cover_url, video_url, categories, tags, publication_state, published_at, updated_at")
      .order("updated_at", { ascending: false });

    if (primary.error) {
      const fallback = await supabase
        .from("news_items")
        .select("id, title, summary, analysis, source_url, cover_url, categories, tags, published_at")
        .order("published_at", { ascending: false });

      if (fallback.error) {
        setItems([]);
        setStatus(fallback.error.message);
        setLoading(false);
        return;
      }

      setItems((fallback.data as NewsItem[]) ?? []);
      setLoading(false);
      return;
    }

    setItems((primary.data as NewsItem[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void loadItems();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => {
      return (
        item.title.toLowerCase().includes(term) ||
        String(item.summary ?? "").toLowerCase().includes(term) ||
        String(item.source_url ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, query]);

  const saveEdit = async () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      setStatus("El título no puede estar vacío.");
      return;
    }

    setSaving(true);
    setStatus(null);

    const categories = editing.categories
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const tags = editing.tags
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const payload: Record<string, any> = {
      title: editing.title.trim(),
      summary: editing.summary.trim() || null,
      analysis: editing.analysis.trim() || null,
      source_url: editing.sourceUrl.trim() || null,
      cover_url: normalizeImageUrl(editing.coverUrl) ?? null,
      video_url: editing.videoUrl.trim() || null,
      categories,
      tags,
      publication_state: editing.publicationState,
      published_at: editing.publicationState === "published" ? new Date().toISOString() : null
    };

    let result = await supabase.from("news_items").update(payload).eq("id", editing.id).select("id");

    if (result.error && /video_url|publication_state/i.test(result.error.message ?? "")) {
      const legacyPayload = { ...payload };
      delete legacyPayload.video_url;
      delete legacyPayload.publication_state;
      result = await supabase.from("news_items").update(legacyPayload).eq("id", editing.id).select("id");
    }

    setSaving(false);

    if (result.error || !result.data?.length) {
      const message = result.error?.message ?? "No se pudo guardar la noticia.";
      setStatus(message);
      toast.error(message);
      return;
    }

    toast.success("Noticia actualizada.");
    setStatus("Noticia actualizada. No se generó, ingirió ni programó contenido.");
    setEditing(null);
    await loadItems();
  };

  const deleteItem = async (item: NewsItem) => {
    if (!window.confirm(`Eliminar “${item.title}”?`)) return;

    setDeletingId(item.id);
    setStatus(null);
    const { ok, json } = await authApiRequest("/api/admin/delete", {
      method: "POST",
      jsonBody: { table: "news_items", id: item.id }
    });
    setDeletingId(null);

    if (!ok) {
      const message = json?.error ?? "No se pudo eliminar la noticia.";
      setStatus(message);
      toast.error(message);
      return;
    }

    setItems((current) => current.filter((row) => row.id !== item.id));
    if (editing?.id === item.id) setEditing(null);
    toast.success("Noticia eliminada.");
  };

  return (
    <main>
      <div className="dashboard-section-intro">
        <div>
          <p className="page-kicker">Administración</p>
          <h1 className="section-title">Noticias</h1>
          <p className="muted">Aquí solo revisas, editas, publicas o eliminas noticias existentes. Generación e ingesta se hacen desde Sin Pelos AI.</p>
        </div>
      </div>

      {status ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>{status}</p>
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 }}>
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por título, resumen o fuente..." />
        <button className="button secondary" type="button" onClick={() => void loadItems()} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.15fr) minmax(340px, 0.85fr)", gap: 18, marginTop: 18, alignItems: "start" }}>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Noticias existentes</h2>
          {loading ? <p className="muted">Cargando...</p> : null}
          {!loading && filtered.length === 0 ? <p className="muted">No hay noticias para mostrar.</p> : null}

          <div className="list">
            {filtered.map((item) => (
              <article key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <strong>{item.title}</strong>
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      {item.publication_state === "draft" ? "Borrador" : "Publicada"} · {fmtDate(item.updated_at ?? item.published_at)}
                    </div>
                  </div>
                  <span className="news-badge">{item.publication_state === "draft" ? "DRAFT" : "LIVE"}</span>
                </div>

                {item.summary ? <p className="muted" style={{ margin: 0 }}>{item.summary}</p> : null}

                <div className="admin-item-actions">
                  <button className="button secondary" type="button" onClick={() => setEditing(toEditState(item))}>Editar</button>
                  <Link className="button secondary" href={newsHref(item)} target="_blank">Ver publicada</Link>
                  <button className="button secondary" type="button" onClick={() => void deleteItem(item)} disabled={deletingId === item.id}>
                    {deletingId === item.id ? "Eliminando..." : "Eliminar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card" style={{ position: "sticky", top: 20 }}>
          <h2 style={{ marginTop: 0 }}>Editor</h2>
          {!editing ? (
            <p className="muted">Selecciona una noticia para editarla.</p>
          ) : (
            <div className="form-stack">
              <label>
                Título
                <input className="input" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
              </label>
              <label>
                Resumen
                <textarea className="input" rows={4} value={editing.summary} onChange={(event) => setEditing({ ...editing, summary: event.target.value })} />
              </label>
              <label>
                Análisis
                <textarea className="input" rows={7} value={editing.analysis} onChange={(event) => setEditing({ ...editing, analysis: event.target.value })} />
              </label>
              <label>
                Fuente
                <input className="input" value={editing.sourceUrl} onChange={(event) => setEditing({ ...editing, sourceUrl: event.target.value })} />
              </label>
              <label>
                Portada
                <input className="input" value={editing.coverUrl} onChange={(event) => setEditing({ ...editing, coverUrl: event.target.value })} />
              </label>
              <label>
                Video
                <input className="input" value={editing.videoUrl} onChange={(event) => setEditing({ ...editing, videoUrl: event.target.value })} />
              </label>
              <label>
                Categorías (separadas por coma)
                <input className="input" value={editing.categories} onChange={(event) => setEditing({ ...editing, categories: event.target.value })} />
              </label>
              <label>
                Tags (separados por coma)
                <input className="input" value={editing.tags} onChange={(event) => setEditing({ ...editing, tags: event.target.value })} />
              </label>
              <label>
                Estado
                <select className="input" value={editing.publicationState} onChange={(event) => setEditing({ ...editing, publicationState: event.target.value as "draft" | "published" })}>
                  <option value="draft">Borrador</option>
                  <option value="published">Publicada</option>
                </select>
              </label>

              <div className="admin-item-actions">
                <button className="button" type="button" onClick={() => void saveEdit()} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                <button className="button secondary" type="button" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
