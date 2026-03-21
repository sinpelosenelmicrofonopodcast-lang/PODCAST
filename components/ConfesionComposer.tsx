"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ConfesionComposer() {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

    const response = await fetch("/api/confessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        body,
        isAnonymous: true
      })
    });
    const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };

    if (!response.ok || !json?.ok) {
      setStatus(json?.error ?? "No se pudo publicar la confesion.");
      setLoading(false);
      return;
    }

    setBody("");
    setStatus("Confesion publicada anonimamente.");
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>Confesar anonimamente</h3>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <textarea
          className="textarea"
          rows={4}
          placeholder="Escribe tu confesion... nadie va a ver tu nombre."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Publicando..." : "Publicar anonima"}
        </button>
        {status ? <p className="muted">{status}</p> : null}
      </form>
    </div>
  );
}
