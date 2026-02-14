"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function CommentComposer({ contentId, contentType }: { contentId: string; contentType: string }) {
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

    const { error } = await supabase.from("comments").insert({
      content_id: contentId,
      content_type: contentType,
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
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 8, marginTop: 10 }}>
      <textarea
        className="textarea"
        rows={2}
        placeholder="Responder..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        required
      />
      <button className="button secondary" type="submit" disabled={loading}>
        {loading ? "Publicando..." : "Responder"}
      </button>
      {status ? <p className="muted">{status}</p> : null}
    </form>
  );
}
