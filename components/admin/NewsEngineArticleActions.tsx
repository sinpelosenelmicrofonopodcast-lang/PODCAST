"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { authJsonFetch } from "@/lib/clientApi";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { supabase } from "@/lib/supabaseClient";

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
  sourceName: string | null;
  sourceUrl: string | null;
  category: string | null;
  region: string | null;
  summary: string | null;
  analysis: string | null;
  excerpt: string | null;
  tags: string[];
  hashtags: string[];
  coverImageUrl: string | null;
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string | null;
  trendingScore: number;
  discoverScore: number;
  impactScore: number;
  qualityScore: number;
  qualityReasons: string[];
  socialDrafts: SocialDraft[];
};

type Props = {
  article: NewsEngineArticleCard;
  onChanged?: () => void | Promise<void>;
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

function toCsv(values: string[]) {
  return values.join(", ");
}

function fromCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function NewsEngineArticleActions({ article, onChanged }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [editor, setEditor] = useState({
    title: article.title,
    summary: article.summary ?? "",
    analysis: article.analysis ?? "",
    category: article.category ?? "",
    region: article.region ?? "",
    tags: toCsv(article.tags),
    hashtags: toCsv(article.hashtags),
    coverImageUrl: article.coverImageUrl ?? ""
  });
  const [social, setSocial] = useState<SocialEditorState>(() => createInitialSocialState(article));

  const refreshPage = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const syncParent = () => {
    if (!onChanged) return;
    void onChanged();
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

  const uploadCover = async (file: File) => {
    setUploadingCover(true);
    setStatus(null);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Debes iniciar sesión para subir portada.");

      const ext = file.name.split(".").pop() ?? "jpg";
      const filePath = `news/${userId}-${Date.now()}.${ext}`;

      const upload = await supabase.storage.from("news-covers").upload(filePath, file, {
        upsert: true,
        contentType: file.type
      });
      if (upload.error) throw new Error(upload.error.message);

      const { data } = supabase.storage.from("news-covers").getPublicUrl(filePath);
      const publicUrl = normalizeImageUrl(data?.publicUrl) ?? data?.publicUrl ?? "";
      if (!publicUrl) throw new Error("No se pudo obtener la URL pública de la portada.");

      setEditor((current) => ({ ...current, coverImageUrl: publicUrl }));
      setStatus("Portada subida. Guarda el draft para aplicarla.");
    } catch (error: any) {
      setStatus(error?.message ?? "No se pudo subir la portada.");
    } finally {
      setUploadingCover(false);
    }
  };

  const saveArticle = async () => {
    const json = await request(`/api/admin/articles/${article.id}`, {
      method: "PATCH",
      body: {
        ...editor,
        tags: fromCsv(editor.tags),
        hashtags: fromCsv(editor.hashtags)
      }
    });

    if (!json) return;
    setStatus("Cambios editoriales guardados.");
    syncParent();
    refreshPage();
  };

  const deleteArticle = async () => {
    if (!window.confirm(`Eliminar el draft "${article.title}"?`)) return;
    const json = await request(`/api/admin/articles/${article.id}`, { method: "DELETE" });
    if (!json) return;
    setStatus("Draft eliminado.");
    syncParent();
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
    if (shouldRefresh) syncParent();
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
    syncParent();
    refreshPage();
  };

  const runQuickAction = async (path: string, body?: Record<string, unknown>, message = "Acción completada.") => {
    const json = await request(path, { body });
    if (!json) return;
    setStatus(message);
    syncParent();
    refreshPage();
  };

  const socialDraftByPlatform = new Map(article.socialDrafts.map((item) => [item.platform, item]));
  const metaPills = [
    article.status,
    article.sourceName || "Sin fuente",
    article.category || "Sin categoría",
    article.region || "Sin región",
    `Impacto ${article.impactScore.toFixed(1)}`,
    `Trend ${article.trendingScore.toFixed(1)}`,
    `Discover ${article.discoverScore.toFixed(1)}`,
    `Calidad ${article.qualityScore.toFixed(0)}`
  ];

  return (
    <article className="card news-engine-article-card">
      <div className="news-engine-preview-grid">
        {article.coverImageUrl ? (
          <div className="news-engine-preview-media">
            <img src={article.coverImageUrl} alt={article.title} className="news-engine-preview-image" />
          </div>
        ) : null}

        <div className="news-engine-preview-copy">
          <div className="news-engine-article-head">
            <div style={{ display: "grid", gap: 6 }}>
              <strong className="news-engine-article-title">{article.title}</strong>
              <p className="muted" style={{ margin: 0 }}>
                /noticias/{article.slug}
              </p>
              <p className="muted" style={{ margin: 0 }}>
                Creado: {fmtDate(article.createdAt)} · Publicación: {fmtDate(article.publishedAt)} · Programado: {fmtDate(article.publishAt)}
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

          <div className="news-engine-preview-block">
            <h3 style={{ margin: 0 }}>Resumen</h3>
            <p className="muted" style={{ margin: 0 }}>
              {article.summary || "Sin resumen."}
            </p>
          </div>

          <div className="news-engine-preview-block">
            <h3 style={{ margin: 0 }}>Análisis</h3>
            <p className="muted news-engine-analysis" style={{ margin: 0 }}>
              {article.analysis || article.excerpt || "Sin análisis todavía."}
            </p>
          </div>

          <div className="news-engine-tag-row">
            {article.tags.map((tag) => (
              <span key={`tag-${tag}`} className="news-engine-pill">
                {tag}
              </span>
            ))}
            {article.hashtags.map((tag) => (
              <span key={`hash-${tag}`} className="news-engine-pill">
                {tag}
              </span>
            ))}
          </div>

          {article.sourceUrl ? (
            <a className="muted" href={article.sourceUrl} target="_blank" rel="noreferrer">
              Ver fuente original
            </a>
          ) : null}
        </div>
      </div>

      {article.qualityReasons.length ? (
        <p className="muted" style={{ margin: 0 }}>
          Revisión sugerida: {article.qualityReasons.join(", ")}
        </p>
      ) : null}

      <div className="admin-item-actions">
        <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => setEditorOpen((value) => !value)}>
          {editorOpen ? "Cerrar editor" : "Editar draft"}
        </button>
        <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={() => setSocialOpen((value) => !value)}>
          {socialOpen ? "Cerrar redes" : "Redes"}
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runQuickAction(`/api/admin/articles/${article.id}/rewrite`, undefined, "Reescritura IA completada.")}
        >
          Regenerar copy IA
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runQuickAction(`/api/admin/articles/${article.id}/generate-assets`, undefined, "Portada y assets regenerados.")}
        >
          Regenerar portada
        </button>
        <button
          className="button"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => runQuickAction(`/api/admin/articles/${article.id}/publish`, { pushNow: true }, "Noticia publicada.")}
        >
          Publish
        </button>
        <button className="button secondary" type="button" disabled={Boolean(busy)} onClick={deleteArticle}>
          Delete
        </button>
      </div>

      {editorOpen ? (
        <section className="news-engine-editor-grid">
          <div className="news-engine-panel">
            <h3 style={{ marginTop: 0 }}>Editor inline</h3>
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
                rows={3}
                value={editor.summary}
                onChange={(event) => setEditor((current) => ({ ...current, summary: event.target.value }))}
              />
            </label>
            <label>
              Análisis
              <textarea
                className="textarea"
                rows={8}
                value={editor.analysis}
                onChange={(event) => setEditor((current) => ({ ...current, analysis: event.target.value }))}
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
            <div className="news-engine-inline-fields">
              <label>
                Tags
                <input
                  className="input"
                  value={editor.tags}
                  onChange={(event) => setEditor((current) => ({ ...current, tags: event.target.value }))}
                  placeholder="crimen, usa, puerto rico"
                />
              </label>
              <label>
                Hashtags
                <input
                  className="input"
                  value={editor.hashtags}
                  onChange={(event) => setEditor((current) => ({ ...current, hashtags: event.target.value }))}
                  placeholder="#SPMNoticias, #PuertoRico"
                />
              </label>
            </div>
            <label>
              URL portada
              <input
                className="input"
                value={editor.coverImageUrl}
                onChange={(event) => setEditor((current) => ({ ...current, coverImageUrl: event.target.value }))}
              />
            </label>
            <label>
              Subir portada
              <input
                className="input"
                type="file"
                accept="image/*"
                disabled={uploadingCover}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadCover(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <div className="admin-item-actions">
              <button className="button" type="button" disabled={Boolean(busy)} onClick={saveArticle}>
                Guardar draft
              </button>
              <span className="muted" style={{ fontSize: 12 }}>
                {uploadingCover ? "Subiendo portada..." : "Puedes pegar URL o subir imagen directamente."}
              </span>
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
                  Guarda el copy por red y publícalo desde aquí.
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
