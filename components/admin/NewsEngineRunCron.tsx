"use client";

import { useState } from "react";
import { authJsonFetch } from "@/lib/clientApi";

export function NewsEngineRunCron() {
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const run = async (task: string, label: string) => {
    setBusy(task);
    setStatus(null);
    const { response, json } = await authJsonFetch("/api/admin/news-engine/run", {
      method: "POST",
      jsonBody: { task }
    });
    setBusy(null);
    if (!response.ok) {
      setStatus(json?.error ?? `No se pudo ejecutar ${label}.`);
      return;
    }

    setStatus(`${label} ejecutado.`);
  };

  return (
    <div className="card" style={{ display: "grid", gap: 10 }}>
      <h3 style={{ margin: 0 }}>Acciones rápidas</h3>
      <div className="admin-item-actions">
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => run("ingest", "News ingest")}>
          Ingestar ahora
        </button>
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => run("trends", "Trends")}>
          Detectar trends
        </button>
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => run("rescore", "Rescore")}>
          Recalcular score
        </button>
      </div>
      <div className="admin-item-actions">
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => run("publish_scheduled", "Publish scheduled")}>
          Publicar programadas
        </button>
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => run("resurfacer", "Resurfacer")}>
          Resurfacer
        </button>
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => run("analytics", "Analytics")}>
          Agregar analytics
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
