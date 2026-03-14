"use client";

import { useEffect, useMemo, useState } from "react";
import { authApiRequest } from "@/lib/clientApi";
import { chicagoDateInputFromNow, chicagoDateTimeLabel } from "@/lib/autoPosts";
import { toast } from "@/lib/toast";

type ScheduledPost = {
  id: string;
  platform: string;
  message: string;
  media_url: string | null;
  link_url?: string | null;
  campaign_key?: string | null;
  campaign_label?: string | null;
  publish_as?: "feed" | "story" | null;
  scheduled_for: string;
  status: "queued" | "publishing" | "posted" | "failed" | "cancelled";
  posted_at: string | null;
  remote_id: string | null;
  error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ApiListPayload = {
  ok: boolean;
  items: ScheduledPost[];
  date: string;
  timezone: string;
  platform?: string;
  summary: { total: number; byStatus: Record<string, number> };
  error?: string;
};

const STATUS_OPTIONS = ["all", "queued", "publishing", "posted", "failed", "cancelled"] as const;
const PLATFORM_OPTIONS = ["all", "facebook_page", "instagram_feed", "instagram_story"] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number];
type PlatformFilter = (typeof PLATFORM_OPTIONS)[number];

export default function AdminAutoPostsPage() {
  const [date, setDate] = useState(chicagoDateInputFromNow());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [items, setItems] = useState<ScheduledPost[]>([]);
  const [summary, setSummary] = useState<{ total: number; byStatus: Record<string, number> }>({ total: 0, byStatus: {} });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("22:00");
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [countOverride, setCountOverride] = useState("");
  const [generating, setGenerating] = useState(false);
  const [manualPlatform, setManualPlatform] = useState<PlatformFilter>("facebook_page");
  const [manualMessage, setManualMessage] = useState("");
  const [manualMediaUrl, setManualMediaUrl] = useState("");
  const [manualLinkUrl, setManualLinkUrl] = useState("");
  const [manualCampaignLabel, setManualCampaignLabel] = useState("");
  const [manualScheduleFor, setManualScheduleFor] = useState(`${chicagoDateInputFromNow()}T09:00`);
  const [creatingManual, setCreatingManual] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [editingMediaUrl, setEditingMediaUrl] = useState("");
  const [editingLinkUrl, setEditingLinkUrl] = useState("");
  const [editingScheduleFor, setEditingScheduleFor] = useState("");

  const [campaignName, setCampaignName] = useState("");
  const [campaignKey, setCampaignKey] = useState("");
  const [campaignStartDate, setCampaignStartDate] = useState(chicagoDateInputFromNow());
  const [campaignDailyTime, setCampaignDailyTime] = useState("10:00");
  const [campaignPlatforms, setCampaignPlatforms] = useState<Array<"facebook_page" | "instagram_feed" | "instagram_story">>(["facebook_page"]);
  const [campaignMessages, setCampaignMessages] = useState("");
  const [campaignMediaUrl, setCampaignMediaUrl] = useState("");
  const [campaignLinkUrl, setCampaignLinkUrl] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const byStatus = useMemo(() => summary.byStatus ?? {}, [summary]);

  const load = async () => {
    setLoading(true);
    setStatus(null);

    const qs = new URLSearchParams({ date, status: statusFilter, platform: platformFilter });
    const { ok, json, response } = await authApiRequest<ApiListPayload>(`/api/admin/auto-posts?${qs.toString()}`);

    if (!ok) {
      setStatus(json?.error ?? `No se pudo cargar auto-posts (HTTP ${response.status}).`);
      setItems([]);
      setSummary({ total: 0, byStatus: {} });
      setLoading(false);
      return;
    }

    setItems(json.items ?? []);
    setSummary(json.summary ?? { total: 0, byStatus: {} });
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, statusFilter, platformFilter]);

  const handleGenerate = async () => {
    setGenerating(true);
    setStatus(null);

    const countParsed = Number(countOverride);
    const payload = {
      date,
      startTime,
      endTime,
      intervalMinutes,
      countOverride: Number.isFinite(countParsed) && countParsed > 0 ? Math.floor(countParsed) : null
    };

    const { ok, json } = await authApiRequest("/api/admin/auto-posts/generate", {
      method: "POST",
      jsonBody: payload
    });

    if (!ok) {
      setStatus(json?.error ?? "No se pudo generar posts.");
      setGenerating(false);
      return;
    }

    toast.success(`Generados ${json?.inserted ?? 0} posts (de ${json?.requested ?? 0} slots).`);
    setGenerating(false);
    await load();
  };

  const handleCreateManual = async () => {
    const message = manualMessage.trim();
    const scheduledFor = manualScheduleFor.trim();
    if (!message) {
      setStatus("Escribe el mensaje del estado.");
      return;
    }
    if (!scheduledFor) {
      setStatus("Selecciona fecha y hora para programar.");
      return;
    }

    setCreatingManual(true);
    setStatus(null);
    const { ok, json } = await authApiRequest("/api/admin/auto-posts", {
      method: "POST",
      jsonBody: {
        platform: manualPlatform,
        message,
        mediaUrl: manualMediaUrl.trim() || null,
        linkUrl: manualLinkUrl.trim() || null,
        campaignLabel: manualCampaignLabel.trim() || null,
        scheduledFor
      }
    });
    if (!ok) {
      setStatus(json?.error ?? "No se pudo crear el estado programado.");
      setCreatingManual(false);
      return;
    }

    toast.success("Estado programado.");
    setManualPlatform("facebook_page");
    setManualMessage("");
    setManualMediaUrl("");
    setManualLinkUrl("");
    setManualCampaignLabel("");
    setCreatingManual(false);
    await load();
  };

  const startEdit = (item: ScheduledPost) => {
    setEditingId(item.id);
    setEditingMessage(item.message);
    setEditingMediaUrl(item.media_url ?? "");
    setEditingLinkUrl(item.link_url ?? "");
    const parsed = new Date(item.scheduled_for);
    const local = Number.isNaN(parsed.getTime())
      ? `${date}T09:00`
      : new Intl.DateTimeFormat("sv-SE", {
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
    setEditingScheduleFor(local);
  };

  const saveEdit = async (id: string) => {
    const { ok, json } = await authApiRequest(`/api/admin/auto-posts/${id}`, {
      method: "PATCH",
      jsonBody: {
        message: editingMessage,
        mediaUrl: editingMediaUrl.trim() || null,
        linkUrl: editingLinkUrl.trim() || null,
        scheduledFor: editingScheduleFor
      }
    });
    if (!ok) {
      setStatus(json?.error ?? "No se pudo guardar edición.");
      return;
    }

    toast.success("Mensaje actualizado.");
    setEditingId(null);
    setEditingMessage("");
    setEditingMediaUrl("");
    setEditingLinkUrl("");
    setEditingScheduleFor("");
    await load();
  };

  const toggleCampaignPlatform = (value: "facebook_page" | "instagram_feed" | "instagram_story") => {
    setCampaignPlatforms((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]));
  };

  const fillYoutubeCampaign = () => {
    const lines = Array.from({ length: 30 }, (_, index) => {
      const variations = [
        "Si todavia no te has suscrito al canal, date la vuelta por YouTube y siguelo.",
        "Si aun no nos sigues en YouTube, este es el recordatorio del dia.",
        "Si no has visto los episodios nuevos, ve al canal y suscribete.",
        "Si sigues aqui pero no en YouTube, corrige eso hoy."
      ];
      const ctas = [
        "Mira el canal aqui: https://www.youtube.com/@SinPelosEnElMicrofono",
        "Suscribete aqui: https://www.youtube.com/@SinPelosEnElMicrofono",
        "Ve a verlo aqui: https://www.youtube.com/@SinPelosEnElMicrofono",
        "Dale follow al canal aqui: https://www.youtube.com/@SinPelosEnElMicrofono"
      ];
      return `${variations[index % variations.length]} ${ctas[(index + 1) % ctas.length]}`;
    });

    setCampaignName("YouTube diario 30 dias");
    setCampaignKey("youtube_follow_30d");
    setCampaignMessages(lines.join("\n"));
    setCampaignPlatforms(["facebook_page"]);
    setCampaignMediaUrl(`${window.location.origin}/logo.png`);
    setCampaignLinkUrl("https://www.youtube.com/@SinPelosEnElMicrofono");
  };

  const createCampaign = async () => {
    const messages = campaignMessages
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!campaignName.trim()) {
      setStatus("Escribe un nombre para la campaña.");
      return;
    }
    if (!campaignStartDate.trim() || !campaignDailyTime.trim()) {
      setStatus("Selecciona fecha inicial y hora diaria.");
      return;
    }
    if (messages.length === 0) {
      setStatus("Pega al menos un estado por línea.");
      return;
    }
    if (campaignPlatforms.length === 0) {
      setStatus("Selecciona al menos una plataforma.");
      return;
    }

    setCreatingCampaign(true);
    setStatus(null);
    const { ok, json } = await authApiRequest("/api/admin/auto-posts/campaign", {
      method: "POST",
      jsonBody: {
        campaignName: campaignName.trim(),
        campaignKey: campaignKey.trim() || null,
        startDate: campaignStartDate,
        dailyTime: campaignDailyTime,
        platforms: campaignPlatforms,
        messages,
        mediaUrl: campaignMediaUrl.trim() || null,
        linkUrl: campaignLinkUrl.trim() || null
      }
    });

    if (!ok) {
      setStatus(json?.error ?? "No se pudo crear la campaña.");
      setCreatingCampaign(false);
      return;
    }

    toast.success(`Campaña programada: ${json?.inserted ?? 0} posts.`);
    setCampaignName("");
    setCampaignKey("");
    setCampaignMessages("");
    setCampaignPlatforms(["facebook_page"]);
    setCampaignMediaUrl("");
    setCampaignLinkUrl("");
    setCreatingCampaign(false);
    await load();
  };

  const cancelPost = async (id: string) => {
    const { ok, json } = await authApiRequest(`/api/admin/auto-posts/${id}`, { method: "DELETE" });
    if (!ok) {
      setStatus(json?.error ?? "No se pudo cancelar el post.");
      return;
    }

    toast.success("Post cancelado.");
    await load();
  };

  const requeuePost = async (id: string) => {
    const { ok, json } = await authApiRequest(`/api/admin/auto-posts/${id}`, {
      method: "PATCH",
      jsonBody: { status: "queued" }
    });
    if (!ok) {
      setStatus(json?.error ?? "No se pudo reencolar el estado.");
      return;
    }

    toast.success("Estado reencolado.");
    await load();
  };

  const deletePost = async (id: string) => {
    const confirmed = window.confirm("¿Eliminar este estado de forma permanente?");
    if (!confirmed) return;

    const { ok, json } = await authApiRequest(`/api/admin/auto-posts/${id}/purge`, { method: "DELETE" });
    if (!ok) {
      setStatus(json?.error ?? "No se pudo eliminar el estado.");
      return;
    }

    toast.success("Estado eliminado.");
    await load();
  };

  const postNow = async (id: string) => {
    const { ok, json } = await authApiRequest(`/api/admin/auto-posts/${id}/post-now`, { method: "POST" });
    if (!ok) {
      setStatus(json?.error ?? "No se pudo publicar ahora.");
      return;
    }

    toast.success("Publicado en Facebook.");
    await load();
  };

  return (
    <main>
      <h1 className="section-title">Auto Posts</h1>
      <p className="muted">Genera y programa publicaciones automáticas para Facebook Page (America/Chicago).</p>

      <div className="card" style={{ marginTop: 16, display: "grid", gap: 12 }}>
        <strong>Generador</strong>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
          }}
        >
          <label>
            Fecha
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Inicio
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </label>
          <label>
            Fin
            <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </label>
          <label>
            Intervalo (min)
            <input
              className="input"
              type="number"
              min={5}
              step={5}
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(Math.max(5, Number(e.target.value || 30)))}
            />
          </label>
        </div>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}
        >
          <label>
            Cantidad (opcional)
            <input
              className="input"
              type="number"
              min={1}
              placeholder="Ej: 12"
              value={countOverride}
              onChange={(e) => setCountOverride(e.target.value)}
            />
          </label>
          <label>
            Filtro status
            <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-submit-bar">
          <button className="button" type="button" onClick={handleGenerate} disabled={generating}>
            {generating ? "Generando..." : "Generar posts del día"}
          </button>
          <button className="button secondary" type="button" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Actualizar lista"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <strong>Programar estado manual</strong>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}
        >
          <label>
            Plataforma
            <select className="select" value={manualPlatform} onChange={(e) => setManualPlatform(e.target.value as PlatformFilter)}>
              {PLATFORM_OPTIONS.filter((value) => value !== "all").map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>
          <label>
            Campaña / etiqueta
            <input
              className="input"
              value={manualCampaignLabel}
              onChange={(e) => setManualCampaignLabel(e.target.value)}
              placeholder="Ej: Promo cliente marzo"
            />
          </label>
        </div>
        <label>
          Mensaje
          <textarea
            className="textarea"
            rows={3}
            value={manualMessage}
            onChange={(e) => setManualMessage(e.target.value)}
            placeholder="Escribe el estado que quieres publicar en Facebook..."
          />
        </label>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}
        >
          <label>
            Image URL
            <input
              className="input"
              value={manualMediaUrl}
              onChange={(e) => setManualMediaUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label>
            Link URL
            <input
              className="input"
              value={manualLinkUrl}
              onChange={(e) => setManualLinkUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
        </div>
        <label>
          Programar para (America/Chicago)
          <input
            className="input"
            type="datetime-local"
            value={manualScheduleFor}
            onChange={(e) => setManualScheduleFor(e.target.value)}
          />
        </label>
        <div className="form-submit-bar">
          <button className="button" type="button" onClick={handleCreateManual} disabled={creatingManual}>
            {creatingManual ? "Programando..." : "Programar estado"}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <strong>Campaña diaria editable</strong>
        <p className="muted" style={{ margin: 0 }}>
          Pega un estado por línea. Si pegas 30 líneas, se programan 30 días corridos. Instagram requiere `Image URL`.
        </p>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}
        >
          <label>
            Nombre campaña
            <input className="input" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Promo sponsor abril" />
          </label>
          <label>
            Campaign key
            <input className="input" value={campaignKey} onChange={(e) => setCampaignKey(e.target.value)} placeholder="promo_sponsor_abril" />
          </label>
          <label>
            Fecha inicial
            <input className="input" type="date" value={campaignStartDate} onChange={(e) => setCampaignStartDate(e.target.value)} />
          </label>
          <label>
            Hora diaria
            <input className="input" type="time" value={campaignDailyTime} onChange={(e) => setCampaignDailyTime(e.target.value)} />
          </label>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {(["facebook_page", "instagram_feed", "instagram_story"] as const).map((platform) => (
            <label key={platform} style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={campaignPlatforms.includes(platform)} onChange={() => toggleCampaignPlatform(platform)} />
              <span>{platform}</span>
            </label>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
          }}
        >
          <label>
            Image URL
            <input className="input" value={campaignMediaUrl} onChange={(e) => setCampaignMediaUrl(e.target.value)} placeholder="https://..." />
          </label>
          <label>
            Link URL
            <input className="input" value={campaignLinkUrl} onChange={(e) => setCampaignLinkUrl(e.target.value)} placeholder="https://..." />
          </label>
        </div>
        <label>
          Estados diarios
          <textarea
            className="textarea"
            rows={10}
            value={campaignMessages}
            onChange={(e) => setCampaignMessages(e.target.value)}
            placeholder={"Pega un estado por línea.\nEjemplo línea 1...\nEjemplo línea 2..."}
          />
        </label>
        <div className="form-submit-bar">
          <button className="button secondary" type="button" onClick={fillYoutubeCampaign}>
            Cargar preset YouTube 30 días
          </button>
          <button className="button" type="button" onClick={createCampaign} disabled={creatingCampaign}>
            {creatingCampaign ? "Programando..." : "Programar campaña"}
          </button>
        </div>
      </div>

      {status ? (
        <div className="card" style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 18 }}>
        <div className="muted" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span>Total: {summary.total}</span>
          <span>Queued: {byStatus.queued ?? 0}</span>
          <span>Publishing: {byStatus.publishing ?? 0}</span>
          <span>Posted: {byStatus.posted ?? 0}</span>
          <span>Failed: {byStatus.failed ?? 0}</span>
          <span>Cancelled: {byStatus.cancelled ?? 0}</span>
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginTop: 12 }}>
          <label>
            Platform
            <select className="select" value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value as PlatformFilter)}>
              {PLATFORM_OPTIONS.map((platform) => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Hora (Chicago)</th>
                <th>Plataforma</th>
                <th>Campaña</th>
                <th>Mensaje</th>
                <th>Status</th>
                <th>Logs</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{chicagoDateTimeLabel(item.scheduled_for)}</td>
                  <td>{item.platform}</td>
                  <td>{item.campaign_label ?? item.campaign_key ?? "—"}</td>
                  <td style={{ minWidth: 360 }}>
                    {editingId === item.id ? (
                      <div style={{ display: "grid", gap: 8 }}>
                        <textarea
                          className="textarea"
                          rows={3}
                          value={editingMessage}
                          onChange={(e) => setEditingMessage(e.target.value)}
                        />
                        <input
                          className="input"
                          value={editingMediaUrl}
                          onChange={(e) => setEditingMediaUrl(e.target.value)}
                          placeholder="Image URL"
                        />
                        <input
                          className="input"
                          value={editingLinkUrl}
                          onChange={(e) => setEditingLinkUrl(e.target.value)}
                          placeholder="Link URL"
                        />
                        <input
                          className="input"
                          type="datetime-local"
                          value={editingScheduleFor}
                          onChange={(e) => setEditingScheduleFor(e.target.value)}
                        />
                        <div className="form-submit-bar">
                          <button className="button secondary" type="button" onClick={() => saveEdit(item.id)}>
                            Guardar
                          </button>
                          <button className="button secondary" type="button" onClick={() => setEditingId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "grid", gap: 6 }}>
                        <span>{item.message}</span>
                        {item.link_url ? <span className="muted">Link: {item.link_url}</span> : null}
                        {item.media_url ? <span className="muted">Image: {item.media_url}</span> : null}
                      </div>
                    )}
                  </td>
                  <td>{item.status}</td>
                  <td className="muted" style={{ minWidth: 220 }}>
                    {item.error ? item.error : item.remote_id ? `remote_id: ${item.remote_id}` : "—"}
                  </td>
                  <td style={{ minWidth: 280 }}>
                    <div className="admin-item-actions">
                      {editingId !== item.id ? (
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => startEdit(item)}
                          disabled={item.status === "posted" || item.status === "publishing"}
                        >
                          Editar
                        </button>
                      ) : null}
                      <button className="button secondary" type="button" onClick={() => postNow(item.id)} disabled={item.status === "publishing"}>
                        Post now
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => requeuePost(item.id)}
                        disabled={item.status === "queued" || item.status === "publishing" || item.status === "posted"}
                      >
                        Reintentar
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => cancelPost(item.id)}
                        disabled={item.status === "posted" || item.status === "cancelled" || item.status === "publishing"}
                      >
                        Cancelar
                      </button>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => deletePost(item.id)}
                        disabled={item.status === "publishing" || item.status === "posted"}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && items.length === 0 ? <p className="muted">No hay posts para esta fecha/filtro.</p> : null}
        </div>
      </div>
    </main>
  );
}
