"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function ConfesionComposer() {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) {
      setStatus("Debes iniciar sesión para confesar.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("confessions").insert({
      body,
      author_id: userId,
      level: "public",
      status: "published"
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setBody("");
    setStatus("Confesión publicada.");
    setLoading(false);
    router.refresh();
  };

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <h3 style={{ marginTop: 0 }}>Confesar (público)</h3>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <textarea
          className="textarea"
          rows={4}
          placeholder="Escribe tu confesión..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Publicando..." : "Publicar"}
        </button>
        {status ? <p className="muted">{status}</p> : null}
      </form>
    </div>
  );
}
