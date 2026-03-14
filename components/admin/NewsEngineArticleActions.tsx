"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { authJsonFetch } from "@/lib/clientApi";

type SocialPlatform = "facebook" | "instagram" | "x" | "tiktok";

type SocialDraft = {
  id: string;
  platform: SocialPlatform;
  status: string;
  externalId: string | null;
  message: string;
  publishAs: "feed" | "story";
  publishedAt: string | null;
};

export type NewsEngineArticleCard = {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  region: string | null;
  summary: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishAt: string | null;
  publishedAt: string | null;
  trendingScore: number;
  discoverScore: number;
  qualityScore: number;
  qualityReasons: string[];
  socialDrafts: SocialDraft[];
};

type Props = {
  article: NewsEngineArticleCard;
};

type SocialEditorState = Record<
  SocialPlatform,
  {
    enabled: boolean;
    message: string;
    publishAs: "feed" | "story";
  }
>;

const PLATFORM_META: Array<{ value: SocialPlatform; label: string }> = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X" },
  { value: "tiktok", label: "TikTok" }
];

function fmtDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-PR");
}

function createInitialSocialState(article: NewsEngineArticleCard): SocialEditorState {
  const draftByPlatform = new Map(article.socialDrafts.map((item) => [item.platform, item]));

  return {
    facebook: {
      enabled: draftByPlatform.has("facebook"),
      message: draftByPlatform.get("facebook")?.message ?? article.summary ?? article.excerpt ?? article.title,
      publishAs: "feed"
    },
    instagram: {
      enabled: draftByPlatform.has("instagram"),
      message: draftByPlatform.get("instagram")?.message ?? article.summary ?? article.excerpt ?? article.title,
      publishAs: draftByPlatform.get("instagram")?.publishAs ?? "feed"
    },
    x: {
      enabled: draftByPlatform.has("x"),
      message: draftByPlatform.get("x")?.message ?? article.summary ?? article.excerpt ?? article.title,
      publishAs: "feed"
    },
    tiktok: {
      enabled: draftByPlatform.has("tiktok"),
      message: draftByPlatform.get("tiktok")?.message ?? article.summary ?? article.excerpt ?? article.title,
      publishAs: "feed"
    }
  };
}

export function NewsEngineArticleActions({ article }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [editor, setEditor] = useState({
    title: article.title,
    summary: article.summary ?? "",
    category: article.category ?? "",
    region: article.region ?? ""
  });
  const [social, setSocial] = useState<SocialEditorState>(() => createInitialSocialState(article));

  const refreshPage = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const request = async (path: string, options?: { method?: string; body?: Record<string, unknown> }) => {
    setBusy(path);
    setStatus(null);

    const { response, json } = await authJsonFetch(path, {
      method: options?.method ?? "POST",
      jsonBody: options?.body
    });
    setBusy(null);

    if (!response.ok || !json?.ok) {
      setStatus(json?.error ?? "No se pudo completar la acción.");
      return null;
    }

    return json;
  };

  const saveArticle = async () => {
    const json = await request(`/api/admin/articles/${article.id}`, {
      method: "PATCH",
      body: editor
    });

    if (!json) return;
    setStatus("Cambios editoriales guardados.");
    refreshPage();
  };

  const getSelectedDrafts = () =>
    PLATFORM_META.map((platform) => ({
      platform: platform.value,
      message: social[platform.value].message,
      publishAs: social[platform.value].publishAs,
      enabled: social[platform.value].enabled
    })).filter((draft) => draft.enabled && draft.message.trim());

  const saveSocialDrafts = async (shouldRefresh = true) => {
    const drafts = getSelectedDrafts();
    if (!drafts.length) {
      setStatus("Selecciona al menos una red con copy.");
      return null;
    }

    const json = await request(`/api/admin/articles/${article.id}/social`, {
      method: "PATCH",
      body: {
        drafts
      }
    });

    if (!json) return null;
    setStatus("Drafts sociales guardados.");
    if (shouldRefresh) refreshPage();
    return json;
  };

  const publishSelectedNow = async () => {
    if (article.status !== "published") {
      setStatus("Primero publica la noticia y luego envíala a redes.");
      return;
    }

    const saved = await saveSocialDrafts(false);
    const ids = Array.isArray(saved?.result?.publicationIds) ? saved.result.publicationIds : [];
    if (!ids.length) return;

    const json = await request("/api/social/publish", {
      body: { ids }
    });

    if (!json) return;
    setStatus(`Redes procesadas: ${json.result?.done ?? 0} publicadas, ${json.result?.failed ?? 0} fallidas.`);
    refreshPage();
  };

  const runQuickAction = async (path: string, body?: Record<string, unknown>, message = "Acción completada.") => {
    const json = await request(path, { body });
    if (!json) return;
    setStatus(message);
    refreshPage();
  };

  const socialDraftByPlatform = new Map(article.socialDrafts.map((item) => [item.platform, item]));
  const metaPills = [
    article.category || "Sin categoría",
    article.region || "Sin región",
    `Trend ${article.trendingScore.toFixed(2)}`,
    `Discover ${article.discoverScore.toFixed(2)}`,
    article.coverImageUrl ? "Imagen OK" : "Sin imagen",
    `Calidad ${article.qualityScore.toFixed(0)}`
  ];

  return (
    <article className="card news-engine-article-card">
      <div className="news-engine-article-head">
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <strong className="news-engine-article-title">{article.title}</strong>
            <span className="news-badge">{article.status}</span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            /noticias/{article.slug}
          </p>
        </div>
        <div className="news-engine-article-meta">
          {metaPills.map((pill) => (
            <span key={pill} className="news-engine-pill">
              {pill}
            </span>
          ))}
        </div>
      </div>

      <p className="muted" style={{ margin: 0 }}>
        {String(article.summary ?? article.excerpt ?? "").trim() || "Sin resumen útil todavía."}
      </p>

      <p className="muted" style={{ margin: 0 }}>
        Publicación: {fmtDate(article.publishedAt)} · Programado: {fmtDate(article.publishAt)}
        {article.qualityReasons.length ? ` · Revisión: ${article.qualityReasons.join(", ")}` : ""}
      </p>

      <div className="admin-item-actions">
        <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => setEditorOpen((value) => !value)}>
          {editorOpen ? "Cerrar editor" : "Editar noticia"}
        </button>
        <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => setSocialOpen((value) => !value)}>
          {socialOpen ? "Cerrar redes" : "Editar/postear redes"}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runQuickAction(`/api/admin/articles/${article.id}/rewrite`, undefined, "Reescritura IA completada.")}
        >
          Reescribir IA
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runQuickAction(`/api/admin/articles/${article.id}/generate-assets`, undefined, "Assets generados.")}
        >
          Assets
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runQuickAction(`/api/admin/articles/${article.id}/generate-poll`, undefined, "Encuesta generada.")}
        >
          Encuesta
        </button>
        <button
          className="button"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runQuickAction(`/api/admin/articles/${article.id}/publish`, { pushNow: true }, "Noticia publicada.")}
        >
          Publicar
        </button>
      </div>

      {editorOpen ? (
        <section className="news-engine-editor-grid">
          <div className="news-engine-panel">
            <h3 style={{ marginTop: 0 }}>Editorial</h3>
            <label>
              Título
              <input
                className="input"
                value={editor.title}
                onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
              />
            </label>
            <label>
              Resumen
              <textarea
                className="textarea"
                rows={4}
                value={editor.summary}
                onChange={(event) => setEditor((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
            <div className="news-engine-inline-fields">
              <label>
                Categoría
                <input
                  className="input"
                  value={editor.category}
                  onChange={(event) => setEditor((current) => ({ ...current, category: event.target.value }))}
                />
              </label>
              <label>
                Región
                <input
                  className="input"
                  value={editor.region}
                  onChange={(event) => setEditor((current) => ({ ...current, region: event.target.value }))}
                />
              </label>
            </div>
            <div className="admin-item-actions">
              <button className="button" type="button" disabled={Boolean(busy)} onClick={saveArticle}>
                Guardar noticia
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {socialOpen ? (
        <section className="news-engine-editor-grid">
          <div className="news-engine-panel">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0 }}>Redes</h3>
                <p className="muted" style={{ margin: "4px 0 0" }}>
                  Guarda el copy por red y publícalo aquí mismo.
                </p>
              </div>
              <span className="news-engine-pill">{article.status === "published" ? "Listo para social" : "Pendiente de publicar"}</span>
            </div>

            <div className="news-engine-social-grid">
              {PLATFORM_META.map((platform) => {
                const publication = socialDraftByPlatform.get(platform.value);
                return (
                  <div key={platform.value} className="news-engine-social-card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <label className="check-row" style={{ margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={social[platform.value].enabled}
                          onChange={(event) =>
                            setSocial((current) => ({
                              ...current,
                              [platform.value]: {
                                ...current[platform.value],
                                enabled: event.target.checked
                              }
                            }))
                          }
                        />
                        {platform.label}
                      </label>
                      <span className="news-badge">{publication?.status ?? "nuevo"}</span>
                    </div>
                    <textarea
                      className="textarea"
                      rows={3}
                      value={social[platform.value].message}
                      onChange={(event) =>
                        setSocial((current) => ({
                          ...current,
                          [platform.value]: {
                            ...current[platform.value],
                            message: event.target.value
                          }
                        }))
                      }
                    />
                    {platform.value === "instagram" ? (
                      <label>
                        Formato
                        <select
                          className="input"
                          value={social.instagram.publishAs}
                          onChange={(event) =>
                            setSocial((current) => ({
                              ...current,
                              instagram: {
                                ...current.instagram,
                                publishAs: event.target.value === "story" ? "story" : "feed"
                              }
                            }))
                          }
                        >
                          <option value="feed">Feed</option>
                          <option value="story">Story</option>
                        </select>
                      </label>
                    ) : null}
                    <p className="muted" style={{ margin: 0 }}>
                      {publication?.publishedAt ? `Publicado: ${fmtDate(publication.publishedAt)}` : "Sin publicación todavía."}
                      {publication?.externalId ? ` · ID: ${publication.externalId}` : ""}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="admin-item-actions">
              <button
                className="button secondary"
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  runQuickAction(
                    `/api/admin/articles/${article.id}/generate-social`,
                    { platforms: PLATFORM_META.map((platform) => platform.value) },
                    "Copy social generado."
                  )
                }
              >
                Generar IA social
              </button>
              <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => saveSocialDrafts()}>
                Guardar drafts
              </button>
              <button className="button" type="button" disabled={Boolean(busy)} onClick={publishSelectedNow}>
                Postear ahora
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {status ? (
        <p className="muted" style={{ margin: 0 }}>
          {busy ? "Procesando..." : status}
        </p>
      ) : null}
    </article>
  );
}
