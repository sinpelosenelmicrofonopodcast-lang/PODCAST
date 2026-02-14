"use client";

import { useState } from "react";

export function AdminSyncYouTube() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/social/youtube/sync", { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setStatus(data.error ?? "Error al sincronizar");
      } else {
        setStatus(`Sincronizado. Nuevos posts: ${data.inserted}`);
      }
    } catch (error: any) {
      setStatus(error?.message ?? "Error al sincronizar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3>Sync YouTube</h3>
      <p className="muted">Importa los últimos videos y shorts del canal.</p>
      <button className="button" type="button" onClick={handleSync} disabled={loading}>
        {loading ? "Sincronizando..." : "Sincronizar ahora"}
      </button>
      {status ? <p className="muted">{status}</p> : null}
    </div>
  );
}
