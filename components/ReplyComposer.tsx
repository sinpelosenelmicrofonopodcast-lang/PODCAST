"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function ReplyComposer({ threadId }: { threadId: string }) {
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
      setStatus("Debes iniciar sesión para responder.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("replies").insert({
      thread_id: threadId,
      author_id: userId,
      body
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setBody("");
    setStatus("Respuesta publicada.");
    setLoading(false);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="thread-reply-form">
      <textarea
        className="textarea"
        rows={2}
        aria-label="Escribe una respuesta"
        placeholder="Responder con contexto y claridad..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
      />
      <button className="button secondary thread-reply-submit" type="submit" disabled={loading}>
        {loading ? "Publicando..." : "Responder"}
      </button>
      {status ? <p className="status-text">{status}</p> : null}
    </form>
  );
}
