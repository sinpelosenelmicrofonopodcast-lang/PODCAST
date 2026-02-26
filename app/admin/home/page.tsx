"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type HomeSettings = {
  id: string;
  hero_kicker: string;
  hero_title: string;
  hero_subtitle: string;
  opinion_title: string;
  opinion_body: string;
  opinion_cta_label: string;
  opinion_cta_href: string;
  show_latest_news: boolean;
  show_latest_blog: boolean;
  show_latest_community_post: boolean;
  show_upcoming_events: boolean;
  show_promotions: boolean;
  editors_pick_news_ids: string[];
  trending_weight_comments: number;
  trending_weight_shares: number;
  trending_weight_views: number;
};

type NewsOption = {
  id: string;
  title: string;
  published_at: string | null;
};

const EXTENDED_COLUMNS_REGEX =
  /(editors_pick_news_ids|trending_weight_comments|trending_weight_shares|trending_weight_views|opinion_title|opinion_body|opinion_cta_label|opinion_cta_href)/i;

const DEFAULT_WEIGHTS = {
  trending_weight_comments: 0.45,
  trending_weight_shares: 0.35,
  trending_weight_views: 0.2
};

const DEFAULT_OPINION = {
  opinion_title: "Opinión del día",
  opinion_body: "Aquí va la postura editorial del día.",
  opinion_cta_label: "Ir al foro",
  opinion_cta_href: "/foro"
};

export default function AdminHomePage() {
  const [settings, setSettings] = useState<HomeSettings | null>(null);
  const [newsOptions, setNewsOptions] = useState<NewsOption[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supportsEditorialColumns, setSupportsEditorialColumns] = useState(true);

  useEffect(() => {
    const load = async () => {
      setSchemaWarning(null);
      const primary = await supabase
        .from("home_settings")
        .select(
          "id, hero_kicker, hero_title, hero_subtitle, opinion_title, opinion_body, opinion_cta_label, opinion_cta_href, show_latest_news, show_latest_blog, show_latest_community_post, show_upcoming_events, show_promotions, editors_pick_news_ids, trending_weight_comments, trending_weight_shares, trending_weight_views"
        )
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      let data = primary.data;
      let error = primary.error;

      if (error && EXTENDED_COLUMNS_REGEX.test(error.message)) {
        setSupportsEditorialColumns(false);
        setSchemaWarning(
          "Faltan columnas de Home editorial. Aplica `supabase/home_editorial_sprint1.sql` y `supabase/home_editorial_sprint2.sql`."
        );
        const fallback = await supabase
          .from("home_settings")
          .select(
            "id, hero_kicker, hero_title, hero_subtitle, show_latest_news, show_latest_blog, show_latest_community_post, show_upcoming_events, show_promotions"
          )
          .order("updated_at", { ascending: false })
          .limit(1)
          .single();
        data = fallback.data as any;
        error = fallback.error;
      } else {
        setSupportsEditorialColumns(true);
      }

      if (error || !data) {
        setStatus(error?.message ?? "No se pudo cargar Home settings.");
        return;
      }

      const normalized = data as any;
      setSettings({
        id: normalized.id,
        hero_kicker: normalized.hero_kicker,
        hero_title: normalized.hero_title,
        hero_subtitle: normalized.hero_subtitle,
        opinion_title: String(normalized.opinion_title ?? DEFAULT_OPINION.opinion_title),
        opinion_body: String(normalized.opinion_body ?? DEFAULT_OPINION.opinion_body),
        opinion_cta_label: String(normalized.opinion_cta_label ?? DEFAULT_OPINION.opinion_cta_label),
        opinion_cta_href: String(normalized.opinion_cta_href ?? DEFAULT_OPINION.opinion_cta_href),
        show_latest_news: normalized.show_latest_news,
        show_latest_blog: normalized.show_latest_blog,
        show_latest_community_post: normalized.show_latest_community_post,
        show_upcoming_events: normalized.show_upcoming_events,
        show_promotions: normalized.show_promotions,
        editors_pick_news_ids: Array.isArray(normalized.editors_pick_news_ids) ? normalized.editors_pick_news_ids : [],
        trending_weight_comments: Number(normalized.trending_weight_comments ?? DEFAULT_WEIGHTS.trending_weight_comments),
        trending_weight_shares: Number(normalized.trending_weight_shares ?? DEFAULT_WEIGHTS.trending_weight_shares),
        trending_weight_views: Number(normalized.trending_weight_views ?? DEFAULT_WEIGHTS.trending_weight_views)
      });

      const latestNewsPrimary = await supabase
        .from("news_items")
        .select("id, title, published_at")
        .eq("publication_state", "published")
        .order("published_at", { ascending: false })
        .limit(24);
      const latestNews =
        latestNewsPrimary.error && /publication_state/i.test(latestNewsPrimary.error.message)
          ? await supabase.from("news_items").select("id, title, published_at").order("published_at", { ascending: false }).limit(24)
          : latestNewsPrimary;
      setNewsOptions((latestNews.data as NewsOption[] | null) ?? []);
    };
    load();
  }, []);

  const update = (field: keyof HomeSettings, value: string | boolean | number) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value } as HomeSettings);
  };

  const save = async () => {
    if (!settings) return;
    setLoading(true);
    setStatus(null);
    const basePayload: Record<string, any> = {
      hero_kicker: settings.hero_kicker,
      hero_title: settings.hero_title,
      hero_subtitle: settings.hero_subtitle,
      show_latest_news: settings.show_latest_news,
      show_latest_blog: settings.show_latest_blog,
      show_latest_community_post: settings.show_latest_community_post,
      show_upcoming_events: settings.show_upcoming_events,
      show_promotions: settings.show_promotions,
      updated_at: new Date().toISOString()
    };
    if (supportsEditorialColumns) {
      basePayload.editors_pick_news_ids = settings.editors_pick_news_ids;
      basePayload.trending_weight_comments = Math.max(0, Number(settings.trending_weight_comments || 0));
      basePayload.trending_weight_shares = Math.max(0, Number(settings.trending_weight_shares || 0));
      basePayload.trending_weight_views = Math.max(0, Number(settings.trending_weight_views || 0));
      basePayload.opinion_title = settings.opinion_title;
      basePayload.opinion_body = settings.opinion_body;
      basePayload.opinion_cta_label = settings.opinion_cta_label;
      basePayload.opinion_cta_href = settings.opinion_cta_href;
    }

    const { error } = await supabase
      .from("home_settings")
      .update(basePayload)
      .eq("id", settings.id);

    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus(
      supportsEditorialColumns
        ? "Home actualizada."
        : "Home base actualizada. Aplica SQL de Sprint 1 y Sprint 2 para habilitar edición editorial completa."
    );
  };

  const toggleEditorPick = (id: string) => {
    if (!settings) return;
    const selected = new Set(settings.editors_pick_news_ids);
    if (selected.has(id)) selected.delete(id);
    else if (selected.size < 3) selected.add(id);
    setSettings({ ...settings, editors_pick_news_ids: Array.from(selected) });
  };

  return (
    <main>
      <h1 className="section-title">Home Editor</h1>
      <p className="muted">Controla textos del hero y módulos visibles del homepage.</p>
      {!settings ? (
        <p className="muted">Cargando...</p>
      ) : (
        <div className="card form-stack" style={{ marginTop: 20 }}>
          {schemaWarning ? <p className="muted" style={{ margin: 0 }}>{schemaWarning}</p> : null}
          <label>
            Kicker
            <input className="input" value={settings.hero_kicker} onChange={(e) => update("hero_kicker", e.target.value)} />
          </label>
          <label>
            Título
            <input className="input" value={settings.hero_title} onChange={(e) => update("hero_title", e.target.value)} />
          </label>
          <label>
            Subtítulo
            <textarea
              className="textarea"
              rows={4}
              value={settings.hero_subtitle}
              onChange={(e) => update("hero_subtitle", e.target.value)}
            />
          </label>
          <div className="section-divider" />
          <h2 className="section-title" style={{ margin: 0, fontSize: 24 }}>Opinión del día</h2>
          <label>
            Título de bloque
            <input
              className="input"
              value={settings.opinion_title}
              disabled={!supportsEditorialColumns}
              onChange={(e) => update("opinion_title", e.target.value)}
            />
          </label>
          <label>
            Texto editorial
            <textarea
              className="textarea"
              rows={4}
              value={settings.opinion_body}
              disabled={!supportsEditorialColumns}
              onChange={(e) => update("opinion_body", e.target.value)}
            />
          </label>
          <div className="split-2">
            <label>
              CTA label
              <input
                className="input"
                value={settings.opinion_cta_label}
                disabled={!supportsEditorialColumns}
                onChange={(e) => update("opinion_cta_label", e.target.value)}
              />
            </label>
            <label>
              CTA href
              <input
                className="input"
                value={settings.opinion_cta_href}
                disabled={!supportsEditorialColumns}
                onChange={(e) => update("opinion_cta_href", e.target.value)}
              />
            </label>
          </div>
          <div className="check-grid">
            <label className="check-row compact">
              <input type="checkbox" checked={settings.show_latest_news} onChange={(e) => update("show_latest_news", e.target.checked)} />
              Mostrar última noticia
            </label>
            <label className="check-row compact">
              <input type="checkbox" checked={settings.show_latest_blog} onChange={(e) => update("show_latest_blog", e.target.checked)} />
              Mostrar último blog
            </label>
            <label className="check-row compact">
              <input
                type="checkbox"
                checked={settings.show_latest_community_post}
                onChange={(e) => update("show_latest_community_post", e.target.checked)}
              />
              Mostrar último post comunidad
            </label>
            <label className="check-row compact">
              <input
                type="checkbox"
                checked={settings.show_upcoming_events}
                onChange={(e) => update("show_upcoming_events", e.target.checked)}
              />
              Mostrar próximos eventos
            </label>
            <label className="check-row compact">
              <input type="checkbox" checked={settings.show_promotions} onChange={(e) => update("show_promotions", e.target.checked)} />
              Mostrar promociones
            </label>
          </div>
          <div className="section-divider" />
          <h2 className="section-title" style={{ margin: 0, fontSize: 24 }}>Mesa editorial (Home)</h2>
          <p className="muted" style={{ margin: 0 }}>
            Selecciona hasta 3 noticias para “Lo que está prendío”. Si no eliges, toma las últimas publicadas.
          </p>
          <div className="check-grid">
            {newsOptions.map((item) => (
              <label key={item.id} className="check-row compact">
                <input
                  type="checkbox"
                  checked={settings.editors_pick_news_ids.includes(item.id)}
                  onChange={() => toggleEditorPick(item.id)}
                  disabled={!supportsEditorialColumns}
                />
                <span style={{ display: "grid", gap: 2 }}>
                  <span className="clamp-2">{item.title}</span>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {item.published_at ? new Date(item.published_at).toLocaleDateString("es-PR") : ""}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="section-divider" />
          <h2 className="section-title" style={{ margin: 0, fontSize: 24 }}>Pesos de tendencias (Home)</h2>
          <p className="muted" style={{ margin: 0 }}>
            Mezcla de score para ranking: comentarios + shares + views.
          </p>
          <div className="split-3">
            <label>
              Comentarios
              <input
                className="input"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.trending_weight_comments}
                disabled={!supportsEditorialColumns}
                onChange={(e) => update("trending_weight_comments", Number(e.target.value))}
              />
            </label>
            <label>
              Shares
              <input
                className="input"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.trending_weight_shares}
                disabled={!supportsEditorialColumns}
                onChange={(e) => update("trending_weight_shares", Number(e.target.value))}
              />
            </label>
            <label>
              Views
              <input
                className="input"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={settings.trending_weight_views}
                disabled={!supportsEditorialColumns}
                onChange={(e) => update("trending_weight_views", Number(e.target.value))}
              />
            </label>
          </div>
          <div className="form-submit-bar">
            <button type="button" className="button" onClick={save} disabled={loading}>
              {loading ? "Guardando..." : "Guardar Home"}
            </button>
          </div>
          {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
        </div>
      )}
    </main>
  );
}
