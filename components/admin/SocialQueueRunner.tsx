"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function SocialQueueRunner() {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setStatus(null);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token ?? "";

    const res = await fetch("/api/social/publish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ limit: 25 })
    });

    const json = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok || !json?.ok) {
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
