"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { authApiRequest } from "@/lib/clientApi";
import { publishEditorialToFacebook, publishEditorialToInstagram } from "@/lib/editorialAdminClient";
import { toast } from "@/lib/toast";
import { SocialQueueRunner } from "@/components/admin/SocialQueueRunner";
import { NewsEngineArticleActions, type NewsEngineArticleCard } from "@/components/admin/NewsEngineArticleActions";

type ContentType = "news" | "blog" | "episode" | "manual";
type SearchType = "all" | "news" | "blog" | "episode";

type SearchItem = {
  id: string;
  type: "news" | "blog" | "episode";
  slug: string | null;
  title: string;
  text: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  publishedAt: string | null;
};

type UnifiedQueueItem = {
  id: string;
  kind: "job" | "scheduled_post" | "social_publication";
  title: string;
  subtitle: string;
  status: string;
  scheduledFor: string | null;
  createdAt: string | null;
  platform: string | null;
  error: string | null;
  actionKey: string | null;
  meta: Record<string, any>;
};

type OverviewPayload = {
  ok: boolean;
  items: UnifiedQueueItem[];
  summary: {
    total: number;
    byKind: Record<string, number>;
    byStatus: Record<string, number>;
  };
  error?: string;
};

type ContentPayload = {
  ok: boolean;
  items: SearchItem[];
  error?: string;
};

type Props = {
  canManageNews: boolean;
  canManageBlog: boolean;
  canViewSchedule: boolean;
};

type NewsDeskPayload = {
  ok: boolean;
  cards: NewsEngineArticleCard[];
  summary: {
    total: number;
    drafts: number;
    pendingReview: number;
    published: number;
    cutoffHours: number;
    cutoffIso: string;
  };
  error?: string;
};

type QueueFilter = "all" | "job" | "scheduled_post" | "social_publication";
type ComposerDestination = "facebook" | "instagram_feed" | "instagram_story" | "facebook_page";

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-PR");
}

function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(parsed)
    .replace(" ", "T");
}

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function availableDestinations(type: ContentType): Array<{ value: ComposerDestination; label: string; canSchedule: boolean }> {
  if (type === "news") {
    return [
      { value: "facebook", label: "Facebook", canSchedule: true },
      { value: "instagram_feed", label: "Instagram Feed", canSchedule: false },
      { value: "instagram_story", label: "Instagram Story", canSchedule: false }
    ];
  }
  if (type === "blog") {
    return [
      { value: "facebook", label: "Facebook", canSchedule: true },
      { value: "instagram_feed", label: "Instagram Feed", canSchedule: false }
    ];
  }
  if (type === "episode") {
    return [{ value: "facebook", label: "Facebook", canSchedule: true }];
  }
  return [
    { value: "facebook_page", label: "Facebook Page", canSchedule: true },
    { value: "instagram_feed", label: "Instagram Feed", canSchedule: true },
    { value: "instagram_story", label: "Instagram Story", canSchedule: true }
  ];
}

export function AdminSocialHub({ canManageNews, canManageBlog, canViewSchedule }: Props) {
  const [activeTab, setActiveTab] = useState<"news" | "composer" | "queue">(canManageNews ? "news" : "composer");
  const [overview, setOverview] = useState<OverviewPayload["summary"]>({ total: 0, byKind: {}, byStatus: {} });
  const [queueItems, setQueueItems] = useState<UnifiedQueueItem[]>([]);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>("all");
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueStatus, setQueueStatus] = useState<string | null>(null);
  const [queueActionId, setQueueActionId] = useState<string | null>(null);
  const [queueEditingId, setQueueEditingId] = useState<string | null>(null);
  const [queueEditingSchedule, setQueueEditingSchedule] = useState("");

  const [contentType, setContentType] = useState<ContentType>(canManageNews ? "news" : canManageBlog ? "blog" : "manual");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchItems, setSearchItems] = useState<SearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchItem | null>(null);
  const [destination, setDestination] = useState<ComposerDestination>("facebook");
  const [message, setMessage] = useState("");
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [manualLinkUrl, setManualLinkUrl] = useState("");
  const [manualCampaignLabel, setManualCampaignLabel] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [composerBusy, setComposerBusy] = useState(false);
  const [composerStatus, setComposerStatus] = useState<string | null>(null);
  const [newsCards, setNewsCards] = useState<NewsEngineArticleCard[]>([]);
  const [newsSummary, setNewsSummary] = useState<NewsDeskPayload["summary"]>({
    total: 0,
    drafts: 0,
    pendingReview: 0,
    published: 0,
    cutoffHours: 48,
    cutoffIso: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  });
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsStatus, setNewsStatus] = useState<string | null>(null);
  const [newsBusyAction, setNewsBusyAction] = useState<string | null>(null);

  const destinationOptions = useMemo(() => availableDestinations(contentType), [contentType]);

  useEffect(() => {
    if (!destinationOptions.find((option) => option.value === destination)) {
      setDestination(destinationOptions[0]?.value ?? "facebook");
    }
  }, [destination, destinationOptions]);

  const loadOverview = async () => {
    setQueueLoading(true);
    setQueueStatus(null);
    const { ok, json } = await authApiRequest<OverviewPayload>("/api/admin/social/overview");
    setQueueLoading(false);

    if (!ok) {
      setQueueStatus(json?.error ?? "No se pudo cargar la cola social.");
      return;
    }

    setOverview(json.summary);
    setQueueItems(json.items ?? []);
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const loadNewsDesk = async () => {
    if (!canManageNews) return;

    setNewsLoading(true);
    setNewsStatus(null);
    const { ok, json } = await authApiRequest<NewsDeskPayload>("/api/admin/social/news-desk?status=drafts&hours=48&limit=24");
    setNewsLoading(false);

    if (!ok) {
      setNewsStatus(json?.error ?? "No se pudo cargar la bandeja de noticias.");
      return;
    }

    setNewsCards(json.cards ?? []);
    setNewsSummary(json.summary ?? newsSummary);
  };

  useEffect(() => {
    if (activeTab === "news" && canManageNews) {
      void loadNewsDesk();
    }
  }, [activeTab, canManageNews]);

  const runSearch = async () => {
    if (contentType === "manual") {
      setSearchItems([]);
      setSelectedItem(null);
      return;
    }

    setSearchLoading(true);
    setComposerStatus(null);
    const type = contentType as SearchType;
    const qs = new URLSearchParams({ q: searchQuery.trim(), type, limit: "12" });
    const { ok, json } = await authApiRequest<ContentPayload>(`/api/admin/social/content?${qs.toString()}`);
    setSearchLoading(false);

    if (!ok) {
      setComposerStatus(json?.error ?? "No se pudo buscar contenido.");
      return;
    }

    setSearchItems(json.items ?? []);
  };

  useEffect(() => {
    setSelectedItem(null);
    setMessage("");
    if (contentType === "manual") {
      setSearchItems([]);
      setScheduleAt("");
      return;
    }
    void runSearch();
  }, [contentType]);

  const selectItem = (item: SearchItem) => {
    setSelectedItem(item);
    setMessage(item.text || item.title);
    setScheduleAt("");
    if (item.type !== contentType) {
      setContentType(item.type);
    }
  };

  const publishSelected = async () => {
    if (contentType === "manual") {
      setComposerStatus("Los posts manuales se programan desde este mismo composer.");
      return;
    }
    if (!selectedItem) {
      setComposerStatus("Selecciona una pieza antes de publicar.");
      return;
    }

    setComposerBusy(true);
    setComposerStatus(null);

    try {
      if ((selectedItem.type === "news" || selectedItem.type === "blog") && destination === "facebook") {
        const result = await publishEditorialToFacebook({
          kind: selectedItem.type,
          id: selectedItem.id,
          slug: selectedItem.slug,
          title: selectedItem.title,
          text: message
        });
        if (!result.ok) throw new Error(result.json?.error ?? "No se pudo publicar en Facebook.");
      } else if ((selectedItem.type === "news" || selectedItem.type === "blog") && destination.startsWith("instagram")) {
        const result = await publishEditorialToInstagram({
          kind: selectedItem.type,
          id: selectedItem.id,
          slug: selectedItem.slug,
          title: selectedItem.title,
          text: message,
          coverUrl: selectedItem.imageUrl,
          story: destination === "instagram_story"
        });
        if (!result.ok) throw new Error(result.json?.error ?? "No se pudo publicar en Instagram.");
      } else if (selectedItem.type === "episode" && destination === "facebook") {
        const result = await authApiRequest("/api/social/meta/facebook/post-episode", {
          method: "POST",
          jsonBody: {
            episodeId: selectedItem.id,
            episodeSlug: selectedItem.slug,
            title: selectedItem.title,
            description: selectedItem.text,
            sourceUrl: selectedItem.linkUrl,
            customText: message
          }
        });
        if (!result.ok) throw new Error(result.json?.error ?? "No se pudo publicar el episodio.");
      } else {
        throw new Error("La combinación de contenido/red no está disponible todavía.");
      }

      toast.success("Publicado.");
      setComposerStatus("Publicado correctamente.");
      await loadOverview();
    } catch (error: any) {
      setComposerStatus(String(error?.message ?? "No se pudo publicar."));
    } finally {
      setComposerBusy(false);
    }
  };

  const scheduleSelected = async () => {
    if (!scheduleAt.trim()) {
      setComposerStatus("Selecciona fecha y hora para programar.");
      return;
    }

    const parsed = new Date(scheduleAt);
    if (!Number.isFinite(parsed.getTime())) {
      setComposerStatus("Fecha/hora inválida.");
      return;
    }

    setComposerBusy(true);
    setComposerStatus(null);

    try {
      if (contentType === "manual") {
        const result = await authApiRequest("/api/admin/auto-posts", {
          method: "POST",
          jsonBody: {
            platform: destination,
            message,
            mediaUrl: normalizeText(manualImageUrl) || null,
            linkUrl: normalizeText(manualLinkUrl) || null,
            campaignLabel: normalizeText(manualCampaignLabel) || null,
            scheduledFor: parsed.toISOString()
          }
        });
        if (!result.ok) throw new Error(result.json?.error ?? "No se pudo programar el post manual.");
      } else if (!selectedItem) {
        throw new Error("Selecciona una pieza antes de programar.");
      } else if ((selectedItem.type === "news" || selectedItem.type === "blog") && destination === "facebook") {
        const result = await publishEditorialToFacebook({
          kind: selectedItem.type,
          id: selectedItem.id,
          slug: selectedItem.slug,
          title: selectedItem.title,
          text: message,
          scheduleFor: parsed.toISOString()
        });
        if (!result.ok) throw new Error(result.json?.error ?? "No se pudo programar en Facebook.");
      } else if (selectedItem.type === "episode" && destination === "facebook") {
        const result = await authApiRequest("/api/social/meta/facebook/post-episode", {
          method: "POST",
          jsonBody: {
            episodeId: selectedItem.id,
            episodeSlug: selectedItem.slug,
            title: selectedItem.title,
            description: selectedItem.text,
            sourceUrl: selectedItem.linkUrl,
            customText: message,
            scheduleFor: parsed.toISOString()
          }
        });
        if (!result.ok) throw new Error(result.json?.error ?? "No se pudo programar el episodio.");
      } else {
        throw new Error("Esa red no soporta programación desde este composer todavía.");
      }

      toast.success("Programado.");
      setComposerStatus("Programado correctamente.");
      await loadOverview();
    } catch (error: any) {
      setComposerStatus(String(error?.message ?? "No se pudo programar."));
    } finally {
      setComposerBusy(false);
    }
  };

  const queueVisibleItems = useMemo(() => {
    if (queueFilter === "all") return queueItems;
    return queueItems.filter((item) => item.kind === queueFilter);
  }, [queueFilter, queueItems]);

  const startQueueReschedule = (item: UnifiedQueueItem) => {
    setQueueEditingId(item.id);
    setQueueEditingSchedule(toDatetimeLocal(item.scheduledFor));
  };

  const saveQueueReschedule = async (item: UnifiedQueueItem) => {
    const parsed = new Date(queueEditingSchedule);
    if (!Number.isFinite(parsed.getTime())) {
      setQueueStatus("Fecha/hora inválida para reprogramar.");
      return;
    }

    setQueueActionId(item.id);
    setQueueStatus(null);

    const result =
      item.kind === "job"
        ? await authApiRequest(`/api/admin/jobs/${item.id}`, {
            method: "PATCH",
            jsonBody: { scheduledFor: parsed.toISOString() }
          })
        : await authApiRequest(`/api/admin/auto-posts/${item.id}`, {
            method: "PATCH",
            jsonBody: { scheduledFor: parsed.toISOString() }
          });

    setQueueActionId(null);

    if (!result.ok) {
      setQueueStatus(result.json?.error ?? "No se pudo reprogramar.");
      return;
    }

    toast.success("Reprogramado.");
    setQueueEditingId(null);
    setQueueEditingSchedule("");
    await loadOverview();
  };

  const queuePostNow = async (item: UnifiedQueueItem) => {
    setQueueActionId(item.id);
    setQueueStatus(null);

    const result =
      item.kind === "job"
        ? await authApiRequest(`/api/admin/jobs/${item.id}/post-now`, { method: "POST" })
        : await authApiRequest(`/api/admin/auto-posts/${item.id}/post-now`, { method: "POST" });

    setQueueActionId(null);

    if (!result.ok) {
      setQueueStatus(result.json?.error ?? "No se pudo publicar ahora.");
      return;
    }

    toast.success("Publicado.");
    await loadOverview();
  };

  const queueCancel = async (item: UnifiedQueueItem) => {
    const confirmed = window.confirm("¿Cancelar este elemento de la cola?");
    if (!confirmed) return;

    setQueueActionId(item.id);
    setQueueStatus(null);

    const result =
      item.kind === "job"
        ? await authApiRequest(`/api/admin/jobs/${item.id}`, { method: "DELETE" })
        : await authApiRequest(`/api/admin/auto-posts/${item.id}`, { method: "DELETE" });

    setQueueActionId(null);

    if (!result.ok) {
      setQueueStatus(result.json?.error ?? "No se pudo cancelar.");
      return;
    }

    toast.success("Cancelado.");
    await loadOverview();
  };

  const canUseComposer =
    contentType === "manual" ||
    (contentType === "news" && canManageNews) ||
    (contentType === "blog" && canManageBlog) ||
    (contentType === "episode" && canManageNews);

  const runNewsIngest = async () => {
    setNewsBusyAction("ingest");
    setNewsStatus(null);
    const result = await authApiRequest("/api/admin/news-engine/run", {
      method: "POST",
      jsonBody: { task: "ingest" }
    });
    setNewsBusyAction(null);

    if (!result.ok) {
      setNewsStatus(result.json?.error ?? "No se pudo correr la ingesta.");
      return;
    }

    toast.success("Ingesta ejecutada.");
    setNewsStatus("Ingesta ejecutada. Refrescando bandeja...");
    await loadNewsDesk();
  };

  const cleanupOldNews = async () => {
    setNewsBusyAction("cleanup");
    setNewsStatus(null);
    const result = await authApiRequest("/api/admin/social/news-desk/cleanup", {
      method: "POST",
      jsonBody: { hours: 48 }
    });
    setNewsBusyAction(null);

    if (!result.ok) {
      setNewsStatus(result.json?.error ?? "No se pudo limpiar la bandeja.");
      return;
    }

    const deleted = Number(result.json?.result?.deleted ?? 0);
    const legacyDeleted = Number(result.json?.result?.legacyDeleted ?? 0);
    toast.success("Limpieza completada.");
    setNewsStatus(`Limpieza completada: ${deleted} drafts y ${legacyDeleted} espejos legacy removidos.`);
    await loadNewsDesk();
  };

  return (
    <main>
      <h1 className="section-title">Social Hub</h1>
      <p className="muted">Publicar, programar y vigilar la cola social desde una sola pantalla.</p>

      <div className="card" style={{ marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {canManageNews ? (
          <button className={activeTab === "news" ? "button" : "button secondary"} type="button" onClick={() => setActiveTab("news")}>
            Noticias
          </button>
        ) : null}
        <button className={activeTab === "composer" ? "button" : "button secondary"} type="button" onClick={() => setActiveTab("composer")}>
          Composer
        </button>
        <button className={activeTab === "queue" ? "button" : "button secondary"} type="button" onClick={() => setActiveTab("queue")}>
          Cola Unificada
        </button>
        <Link className="button secondary" href="/admin/news">
          Noticias legacy
        </Link>
        <Link className="button secondary" href="/admin/blog">
          Blog legacy
        </Link>
        <Link className="button secondary" href="/admin/episodes">
          Episodios legacy
        </Link>
      </div>

      {activeTab === "news" ? (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>Total: {newsSummary.total}</span>
              <span>Drafts: {newsSummary.drafts}</span>
              <span>Pending review: {newsSummary.pendingReview}</span>
              <span>Ventana: {newsSummary.cutoffHours}h</span>
            </div>

            <div className="admin-item-actions">
              <button className="button" type="button" onClick={() => void runNewsIngest()} disabled={newsBusyAction === "ingest"}>
                {newsBusyAction === "ingest" ? "Corriendo..." : "Correr ingesta ahora"}
              </button>
              <button className="button secondary" type="button" onClick={() => void cleanupOldNews()} disabled={newsBusyAction === "cleanup"}>
                {newsBusyAction === "cleanup" ? "Limpiando..." : "Limpiar drafts >48h"}
              </button>
              <button className="button secondary" type="button" onClick={() => void loadNewsDesk()} disabled={newsLoading}>
                {newsLoading ? "Cargando..." : "Refrescar bandeja"}
              </button>
              <Link className="button secondary" href="/admin/news-sources">
                Fuentes
              </Link>
            </div>

            <p className="muted" style={{ margin: 0 }}>
              Aquí aterriza la ingesta automática lista para editar, subir portada y publicar, sin brincar al News Engine.
            </p>
          </div>

          {newsStatus ? (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                {newsStatus}
              </p>
            </div>
          ) : null}

          <div className="list">
            {newsCards.map((article) => (
              <NewsEngineArticleActions key={article.id} article={article} onChanged={loadNewsDesk} />
            ))}
            {!newsLoading && newsCards.length === 0 ? (
              <div className="card">
                <p className="muted" style={{ margin: 0 }}>
                  No hay drafts recientes en la bandeja. La retención de 48 horas mantiene esto limpio automáticamente.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : activeTab === "composer" ? (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <strong>1. Qué quieres publicar</strong>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {([
                { value: "news", label: "Noticia", enabled: canManageNews },
                { value: "blog", label: "Blog", enabled: canManageBlog },
                { value: "episode", label: "Episodio", enabled: canManageNews },
                { value: "manual", label: "Manual", enabled: true }
              ] as Array<{ value: ContentType; label: string; enabled: boolean }>).map((option) => (
                <button
                  key={option.value}
                  className={contentType === option.value ? "button" : "button secondary"}
                  type="button"
                  disabled={!option.enabled}
                  onClick={() => setContentType(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {contentType !== "manual" ? (
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "minmax(240px, 1fr) auto" }}>
                <input
                  className="input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Busca por título, extracto o tema..."
                />
                <button className="button secondary" type="button" onClick={() => void runSearch()} disabled={searchLoading}>
                  {searchLoading ? "Buscando..." : "Buscar"}
                </button>
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: contentType === "manual" ? "1fr" : "minmax(280px, 360px) 1fr" }}>
            {contentType !== "manual" ? (
              <div className="card" style={{ display: "grid", gap: 10 }}>
                <strong>2. Selecciona contenido</strong>
                {searchItems.length === 0 ? <p className="muted" style={{ margin: 0 }}>No hay resultados todavía.</p> : null}
                {searchItems.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    type="button"
                    className="button secondary"
                    style={{
                      textAlign: "left",
                      justifyContent: "flex-start",
                      whiteSpace: "normal",
                      borderColor: selectedItem?.id === item.id ? "#fff" : undefined
                    }}
                    onClick={() => selectItem(item)}
                  >
                    <span>
                      <strong>{item.title}</strong>
                      <br />
                      <span className="muted" style={{ fontSize: 12 }}>
                        {item.type} · {fmtDate(item.publishedAt)}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            <div className="card" style={{ display: "grid", gap: 12 }}>
              <strong>{contentType === "manual" ? "2. Composer manual" : "3. Composer"}</strong>

              {!canUseComposer ? (
                <p className="muted" style={{ margin: 0 }}>
                  Tu usuario no tiene permiso para publicar este tipo de contenido.
                </p>
              ) : null}

              {contentType !== "manual" ? (
                selectedItem ? (
                  <div className="muted" style={{ fontSize: 13 }}>
                    Seleccionado: <strong>{selectedItem.title}</strong>
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>Selecciona una pieza del panel izquierdo.</p>
                )
              ) : null}

              <label>
                Destino
                <select className="select" value={destination} onChange={(e) => setDestination(e.target.value as ComposerDestination)}>
                  {destinationOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Copy
                <textarea
                  className="textarea"
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={contentType === "manual" ? "Escribe el copy manual..." : "Ajusta el copy antes de publicar."}
                />
              </label>

              {contentType === "manual" ? (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
                  }}
                >
                  <label>
                    Image URL
                    <input className="input" value={manualImageUrl} onChange={(e) => setManualImageUrl(e.target.value)} placeholder="https://..." />
                  </label>
                  <label>
                    Link URL
                    <input className="input" value={manualLinkUrl} onChange={(e) => setManualLinkUrl(e.target.value)} placeholder="https://..." />
                  </label>
                  <label>
                    Campaña / etiqueta
                    <input className="input" value={manualCampaignLabel} onChange={(e) => setManualCampaignLabel(e.target.value)} placeholder="Promo abril" />
                  </label>
                </div>
              ) : null}

              <label>
                Programar para (America/Chicago)
                <input className="input" type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} />
              </label>

              <div className="admin-item-actions">
                {contentType !== "manual" ? (
                  <button className="button" type="button" onClick={() => void publishSelected()} disabled={composerBusy || !selectedItem || !canUseComposer}>
                    {composerBusy ? "Procesando..." : "Publicar ahora"}
                  </button>
                ) : null}
                <button className="button secondary" type="button" onClick={() => void scheduleSelected()} disabled={composerBusy || !canUseComposer}>
                  {composerBusy ? "Procesando..." : "Programar"}
                </button>
              </div>

              {composerStatus ? (
                <p className="muted" style={{ margin: 0 }}>
                  {composerStatus}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <span>Total: {overview.total}</span>
              <span>Jobs: {overview.byKind?.job ?? 0}</span>
              <span>Scheduled: {overview.byKind?.scheduled_post ?? 0}</span>
              <span>Social Queue: {overview.byKind?.social_publication ?? 0}</span>
              <span>Queued: {overview.byStatus?.queued ?? 0}</span>
              <span>Failed: {overview.byStatus?.failed ?? 0}</span>
            </div>

            <div className="admin-item-actions">
              <select className="select" value={queueFilter} onChange={(e) => setQueueFilter(e.target.value as QueueFilter)}>
                <option value="all">Todo</option>
                <option value="job">Jobs</option>
                <option value="scheduled_post">Scheduled Posts</option>
                <option value="social_publication">Social Queue</option>
              </select>
              <button className="button secondary" type="button" onClick={() => void loadOverview()} disabled={queueLoading}>
                {queueLoading ? "Cargando..." : "Refrescar"}
              </button>
            </div>

            <div style={{ maxWidth: 260 }}>
              <SocialQueueRunner />
            </div>
            {!canViewSchedule ? (
              <p className="muted" style={{ margin: 0 }}>
                Estás viendo la cola desde permisos editoriales; algunas acciones más operativas pueden seguir protegidas por rol.
              </p>
            ) : null}
          </div>

          {queueStatus ? (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                {queueStatus}
              </p>
            </div>
          ) : null}

          <div className="card">
            <div className="list">
              {queueVisibleItems.map((item) => {
                const canOperateJob = item.kind === "job" && item.actionKey === "job:facebook_post_episode";
                const canOperateScheduled = item.kind === "scheduled_post";
                const isEditable = canOperateJob || canOperateScheduled;

                return (
                  <article key={`${item.kind}-${item.id}`} className="card" style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <strong>{item.title}</strong>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {item.kind} · {item.platform ?? "—"} · {item.subtitle}
                        </div>
                      </div>
                      <div className="news-badge">{item.status}</div>
                    </div>

                    <div className="muted" style={{ fontSize: 12 }}>
                      Programado/Publicado: {fmtDate(item.scheduledFor)} · Creado: {fmtDate(item.createdAt)}
                    </div>

                    {item.error ? (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Error: {item.error}
                      </div>
                    ) : null}

                    {queueEditingId === item.id ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <input className="input" type="datetime-local" value={queueEditingSchedule} onChange={(e) => setQueueEditingSchedule(e.target.value)} />
                        <div className="admin-item-actions">
                          <button className="button secondary" type="button" onClick={() => void saveQueueReschedule(item)} disabled={queueActionId === item.id}>
                            Guardar
                          </button>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => {
                              setQueueEditingId(null);
                              setQueueEditingSchedule("");
                            }}
                            disabled={queueActionId === item.id}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : isEditable ? (
                      <div className="admin-item-actions">
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => void queuePostNow(item)}
                          disabled={queueActionId === item.id || item.status === "running" || item.status === "done" || item.status === "posted"}
                        >
                          Post now
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => startQueueReschedule(item)}
                          disabled={queueActionId === item.id || item.status === "running" || item.status === "done" || item.status === "posted" || item.status === "cancelled"}
                        >
                          Reprogramar
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => void queueCancel(item)}
                          disabled={queueActionId === item.id || item.status === "running" || item.status === "done" || item.status === "posted" || item.status === "cancelled"}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: 12 }}>
                        {item.kind === "social_publication"
                          ? "Este elemento se procesa con el runner de Social Queue."
                          : "Este tipo todavía no tiene acciones inline en el hub."}
                      </div>
                    )}
                  </article>
                );
              })}

              {!queueLoading && queueVisibleItems.length === 0 ? <p className="muted">No hay elementos para este filtro.</p> : null}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <p className="muted" style={{ margin: 0 }}>
          Este hub ya centraliza la operación diaria: noticias ingeridas, composer y cola. Las pantallas viejas quedan como respaldo mientras terminamos la migración.
        </p>
      </div>
    </main>
  );
}
