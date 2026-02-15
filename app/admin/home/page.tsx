"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type HomeSettings = {
  id: string;
  hero_kicker: string;
  hero_title: string;
  hero_subtitle: string;
  show_latest_news: boolean;
  show_latest_blog: boolean;
  show_latest_community_post: boolean;
  show_upcoming_events: boolean;
  show_promotions: boolean;
};

export default function AdminHomePage() {
  const [settings, setSettings] = useState<HomeSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("home_settings")
        .select(
          "id, hero_kicker, hero_title, hero_subtitle, show_latest_news, show_latest_blog, show_latest_community_post, show_upcoming_events, show_promotions"
        )
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      if (error) {
        setStatus(error.message);
        return;
      }
      setSettings(data as HomeSettings);
    };
    load();
  }, []);

  const update = (field: keyof HomeSettings, value: string | boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value } as HomeSettings);
  };

  const save = async () => {
    if (!settings) return;
    setLoading(true);
    setStatus(null);
    const { error } = await supabase
      .from("home_settings")
      .update({
        hero_kicker: settings.hero_kicker,
        hero_title: settings.hero_title,
        hero_subtitle: settings.hero_subtitle,
        show_latest_news: settings.show_latest_news,
        show_latest_blog: settings.show_latest_blog,
        show_latest_community_post: settings.show_latest_community_post,
        show_upcoming_events: settings.show_upcoming_events,
        show_promotions: settings.show_promotions,
        updated_at: new Date().toISOString()
      })
      .eq("id", settings.id);

    setLoading(false);
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Home actualizada.");
  };

  return (
    <main>
      <h1 className="section-title">Home Editor</h1>
      <p className="muted">Controla textos del hero y módulos visibles del homepage.</p>
      {!settings ? (
        <p className="muted">Cargando...</p>
      ) : (
        <div className="card form-stack" style={{ marginTop: 20 }}>
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

