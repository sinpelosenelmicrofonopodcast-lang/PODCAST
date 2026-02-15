"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type MediaRow = {
  id: string;
  storage_path: string;
  kind: "image" | "video";
  mime_type: string | null;
};

export function ThreadMedia({ media }: { media: MediaRow[] }) {
  const [status, setStatus] = useState<string | null>(null);
  const [signed, setSigned] = useState<Array<{ path: string; signedUrl: string | null }>>([]);

  const paths = useMemo(() => media.map((m) => m.storage_path).filter(Boolean), [media]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setStatus(null);
      setSigned([]);

      if (paths.length === 0) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setStatus("Sesión inválida.");
        return;
      }

      const res = await fetch("/api/zona-cruda/media", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ paths })
      });

      const json = await res.json().catch(() => ({}));
      if (!mounted) return;

      if (!res.ok) {
        setStatus("No se pudo cargar media.");
        return;
      }

      const urls = Array.isArray(json?.urls) ? json.urls : [];
      setSigned(urls.map((u: any) => ({ path: u.path, signedUrl: u.signedUrl })));
    };
    run();
    return () => {
      mounted = false;
    };
  }, [paths.join("|")]);

  if (!media || media.length === 0) return null;

  const urlByPath = new Map<string, string | null>(signed.map((u) => [u.path, u.signedUrl]));

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        {media.map((m) => {
          const url = urlByPath.get(m.storage_path) ?? null;
          if (!url) {
            return (
              <div key={m.id} className="card" style={{ padding: 12 }}>
                <p className="muted" style={{ margin: 0 }}>Cargando media…</p>
              </div>
            );
          }
          if (m.kind === "video") {
            return (
              <video
                key={m.id}
                controls
                playsInline
                preload="metadata"
                style={{ width: "100%", borderRadius: 14, background: "#0b0b0c" }}
                src={url}
              />
            );
          }
          return (
            <img
              key={m.id}
              src={url}
              alt="adjunto"
              style={{ width: "100%", borderRadius: 14, objectFit: "cover" }}
            />
          );
        })}
      </div>
    </div>
  );
}

