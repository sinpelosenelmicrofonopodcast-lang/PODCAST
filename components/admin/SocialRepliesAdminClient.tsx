"use client";

import { useEffect, useState } from "react";
import { authApiRequest } from "@/lib/clientApi";
import { toast } from "@/lib/toast";
import type { SocialAutoReplySettings } from "@/lib/socialAutoReply";

type EventRow = {
  id: string;
  platform: string;
  sender_name: string | null;
  message: string;
  decision: string | null;
  matched_rule: string | null;
  reply_message: string | null;
  error: string | null;
  created_at: string;
};

type ApiPayload = {
  ok: boolean;
  settings: SocialAutoReplySettings;
  events: EventRow[];
  error?: string;
};

const DEFAULT_SETTINGS: SocialAutoReplySettings = {
  enabled: false,
  facebookEnabled: true,
  instagramEnabled: false,
  authorCooldownHours: 24,
  maxCommentLength: 280,
  blockedKeywords: ["odio", "mierda", "basura"],
  youtubeUrl: "https://www.youtube.com/@SinPelosEnElMicrofono",
  rules: []
};

export function SocialRepliesAdminClient() {
  const [settings, setSettings] = useState<SocialAutoReplySettings>(DEFAULT_SETTINGS);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [rulesText, setRulesText] = useState("");
  const [blockedKeywordsText, setBlockedKeywordsText] = useState("");

  const serializeRules = (value: SocialAutoReplySettings["rules"]) =>
    value.map((rule) => `${rule.label} | ${rule.platforms.join(",")} | ${rule.keywords.join(",")} | ${rule.replyTemplate}`).join("\n");

  const load = async () => {
    setLoading(true);
    const { ok, json } = await authApiRequest<ApiPayload>("/api/admin/social-replies");
    if (!ok) {
      setStatus(json?.error ?? "No se pudo cargar social replies.");
      setLoading(false);
      return;
    }
    setSettings(json.settings);
    setEvents(json.events ?? []);
    setRulesText(serializeRules(json.settings.rules ?? []));
    setBlockedKeywordsText((json.settings.blockedKeywords ?? []).join(", "));
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    const rules = rulesText
      .split("\n")
      .map((line, index) => {
        const [label, platformsRaw, keywordsRaw, replyTemplate] = line.split("|").map((part) => part.trim());
        if (!label || !platformsRaw || !keywordsRaw || !replyTemplate) return null;
        const platforms = platformsRaw
          .split(",")
          .map((value) => value.trim())
          .filter((value): value is "facebook" | "instagram" => value === "facebook" || value === "instagram");
        const keywords = keywordsRaw
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (platforms.length === 0 || keywords.length === 0) return null;
        return {
          id: `rule_${index + 1}`,
          label,
          enabled: true,
          platforms,
          keywords,
          replyTemplate
        };
      })
      .filter(Boolean);

    setSaving(true);
    setStatus(null);
    const { ok, json } = await authApiRequest<ApiPayload>("/api/admin/social-replies", {
      method: "PATCH",
      jsonBody: {
        ...settings,
        blockedKeywords: blockedKeywordsText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        rules
      }
    });
    if (!ok) {
      setStatus(json?.error ?? "No se pudo guardar configuración.");
      setSaving(false);
      return;
    }
    setSettings(json.settings);
    setRulesText(serializeRules(json.settings.rules ?? []));
    setBlockedKeywordsText((json.settings.blockedKeywords ?? []).join(", "));
    setSaving(false);
    toast.success("Social auto-reply actualizado.");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div className="card" style={{ display: "grid", gap: 12 }}>
        <strong>Configuración</strong>
        <p className="muted" style={{ margin: 0 }}>
          Formato reglas: `Etiqueta | facebook,instagram | keyword1,keyword2 | respuesta`.
        </p>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings((prev) => ({ ...prev, enabled: e.target.checked }))} />
          <span>Activar auto-reply</span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={settings.facebookEnabled}
            onChange={(e) => setSettings((prev) => ({ ...prev, facebookEnabled: e.target.checked }))}
          />
          <span>Facebook</span>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={settings.instagramEnabled}
            onChange={(e) => setSettings((prev) => ({ ...prev, instagramEnabled: e.target.checked }))}
          />
          <span>Instagram</span>
        </label>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label>
            Cooldown autor (horas)
            <input
              className="input"
              type="number"
              min={1}
              max={168}
              value={settings.authorCooldownHours}
              onChange={(e) => setSettings((prev) => ({ ...prev, authorCooldownHours: Math.max(1, Number(e.target.value || 24)) }))}
            />
          </label>
          <label>
            Largo máximo comentario
            <input
              className="input"
              type="number"
              min={20}
              max={1000}
              value={settings.maxCommentLength}
              onChange={(e) => setSettings((prev) => ({ ...prev, maxCommentLength: Math.max(20, Number(e.target.value || 280)) }))}
            />
          </label>
        </div>
        <label>
          URL YouTube
          <input className="input" value={settings.youtubeUrl} onChange={(e) => setSettings((prev) => ({ ...prev, youtubeUrl: e.target.value }))} />
        </label>
        <label>
          Blocked keywords
          <input className="input" value={blockedKeywordsText} onChange={(e) => setBlockedKeywordsText(e.target.value)} />
        </label>
        <label>
          Reglas
          <textarea className="textarea" rows={8} value={rulesText} onChange={(e) => setRulesText(e.target.value)} />
        </label>
        <div className="form-submit-bar">
          <button className="button" type="button" onClick={save} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button className="button secondary" type="button" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Recargar"}
          </button>
        </div>
        {status ? (
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        ) : null}
      </div>

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <strong>Webhook</strong>
        <p className="muted" style={{ margin: 0 }}>
          URL: `/api/social/meta/webhook`
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Variables necesarias: `META_WEBHOOK_VERIFY_TOKEN`, `META_APP_SECRET`, tokens Meta ya configurados.
        </p>
      </div>

      <div className="card" style={{ display: "grid", gap: 12 }}>
        <strong>Eventos recientes</strong>
        <div style={{ overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Red</th>
                <th>Autor</th>
                <th>Comentario</th>
                <th>Decisión</th>
                <th>Reply</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.created_at).toLocaleString("es-PR")}</td>
                  <td>{event.platform}</td>
                  <td>{event.sender_name ?? "—"}</td>
                  <td style={{ minWidth: 260 }}>{event.message}</td>
                  <td>{event.decision ?? "—"}{event.matched_rule ? ` (${event.matched_rule})` : ""}</td>
                  <td style={{ minWidth: 220 }}>{event.reply_message ?? "—"}</td>
                  <td>{event.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && events.length === 0 ? <p className="muted">No hay eventos todavía.</p> : null}
        </div>
      </div>
    </div>
  );
}
