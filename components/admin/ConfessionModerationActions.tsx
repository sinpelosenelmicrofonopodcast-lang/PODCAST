"use client";

import { useState } from "react";
import { authJsonFetch } from "@/lib/clientApi";

export function ConfessionModerationActions({ confessionId }: { confessionId: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const setConfessionStatus = async (nextStatus: "approved" | "rejected" | "published") => {
    setBusy(nextStatus);
    setStatus(null);
    const { response, json } = await authJsonFetch(`/api/admin/confessions/${confessionId}`, {
      method: "PATCH",
      jsonBody: { status: nextStatus }
    });
    setBusy(null);

    if (!response.ok || !json?.ok) {
      setStatus(json?.error ?? "No se pudo actualizar.");
      return;
    }

    setStatus(`Estado actualizado: ${nextStatus}`);
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="admin-item-actions">
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => setConfessionStatus("approved")}>Aprobar</button>
        <button className="button secondary" disabled={Boolean(busy)} onClick={() => setConfessionStatus("rejected")}>Rechazar</button>
        <button className="button" disabled={Boolean(busy)} onClick={() => setConfessionStatus("published")}>Publicar</button>
      </div>
      {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
    </div>
  );
}
