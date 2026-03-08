"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Props = {
  articleId: string;
};

async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

export function NewsEngineArticleActions({ articleId }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const call = async (path: string, body?: Record<string, unknown>) => {
    setBusy(path);
    setStatus(null);
    const res = await fetch(path, {
      method: "POST",
      headers: await authHeaders(),
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok || !json?.ok) {
      setStatus(json?.error ?? "Error ejecutando acción");
      return;
    }
    setStatus("Acción completada.");
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="admin-item-actions">
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => call(`/api/admin/articles/${articleId}/rewrite`)}>
          Reescribir IA
        </button>
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => call(`/api/admin/articles/${articleId}/generate-assets`)}>
          Assets
        </button>
        <button className="button" disabled={Boolean(busy)} onClick={() => call(`/api/admin/articles/${articleId}/publish`, { pushNow: true })}>
          Publicar
        </button>
      </div>
      <div className="admin-item-actions">
        <button
          className="button secondary"
          disabled={Boolean(busy)}
          onClick={() => call(`/api/admin/articles/${articleId}/generate-poll`)}
        >
          Generar encuesta
        </button>
        <button
          className="button secondary"
          disabled={Boolean(busy)}
          onClick={() => call(`/api/admin/articles/${articleId}/generate-social`, { platforms: ["facebook", "instagram", "x", "tiktok"] })}
        >
          Encolar social
        </button>
      </div>
      {status ? (
        <p className="muted" style={{ margin: 0 }}>
          {status}
        </p>
      ) : null}
    </div>
  );
}
