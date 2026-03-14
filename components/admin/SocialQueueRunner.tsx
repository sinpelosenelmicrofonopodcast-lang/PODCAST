"use client";

import { useState } from "react";
import { authJsonFetch } from "@/lib/clientApi";

export function SocialQueueRunner() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setStatus(null);
    const { response, json } = await authJsonFetch("/api/social/publish", {
      method: "POST",
      jsonBody: { limit: 25 }
    });
    setBusy(false);

    if (!response.ok || !json?.ok) {
      setStatus(json?.error ?? "No se pudo procesar cola social.");
      return;
    }

    setStatus(`Procesadas: ${json.result?.done ?? 0} · Fallidas: ${json.result?.failed ?? 0}`);
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button className="button" disabled={busy} onClick={run}>
        {busy ? "Procesando..." : "Procesar cola social"}
      </button>
      {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
    </div>
  );
}
