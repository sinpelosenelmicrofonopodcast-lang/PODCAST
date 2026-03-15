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
    <div className="card dashboard-module-card">
      <div className="dashboard-module-copy">
        <h3>Sync YouTube</h3>
        <p className="muted">Importa videos y shorts del canal para mantener feed y episodios siempre actualizados.</p>
      </div>
      <button className="button" type="button" onClick={handleSync} disabled={loading}>
        {loading ? "Sincronizando..." : "Sincronizar ahora"}
      </button>
      {status ? <p className="status-text">{status}</p> : null}
    </div>
  );
}
