"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function CommunityComposer() {
  const [title, setTitle] = useState("");
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
      setStatus("Debes iniciar sesión para publicar.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("threads").insert({
      title,
      body,
      author_id: userId,
      space: "community",
      visibility: "public",
      status: "published"
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setTitle("");
    setBody("");
    setStatus("Publicado.");
    setLoading(false);
    router.refresh();
  };

  return (
    <section className="card thread-composer">
      <div className="thread-composer-head">
        <h2>Abrir conversación</h2>
        <p className="muted">Crea un thread claro para que otros puedan responder rápido y sin duplicar temas.</p>
      </div>
      <form onSubmit={handleSubmit} className="thread-composer-form">
        <input
          className="input"
          aria-label="Título del thread"
          placeholder="Título de la conversación"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
        <textarea
          className="textarea"
          rows={4}
          aria-label="Contenido del thread"
          placeholder="Expón tu punto con contexto para que la conversación arranque mejor..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />
        <button className="button thread-composer-submit" type="submit" disabled={loading}>
          {loading ? "Publicando..." : "Publicar"}
        </button>
        {status ? <p className="status-text">{status}</p> : null}
      </form>
    </section>
  );
}
