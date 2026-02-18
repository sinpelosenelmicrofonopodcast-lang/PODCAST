"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type CommentRow = {
  id: string;
  body: string;
  created_at: string | null;
  users: { nickname?: string | null; avatar_url?: string | null } | { nickname?: string | null; avatar_url?: string | null }[] | null;
};

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

export function LazyContentComments({
  contentId,
  contentType,
  initialCount = 0
}: {
  contentId: string;
  contentType: "confession" | "theory";
  initialCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadComments = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("comments")
      .select("id, body, created_at, users(nickname, avatar_url)")
      .eq("content_type", contentType)
      .eq("content_id", contentId)
      .order("created_at", { ascending: true })
      .limit(80);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setComments((data as CommentRow[]) ?? []);
    setLoaded(true);
    setLoading(false);
  };

  const onToggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !loaded && !loading) await loadComments();
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button className="button secondary" type="button" onClick={onToggle}>
        {open ? "Ocultar respuestas" : `Ver respuestas (${initialCount})`}
      </button>
      {open ? (
        <div style={{ display: "grid", gap: 8 }}>
          {loading ? <p className="muted" style={{ margin: 0 }}>Cargando respuestas...</p> : null}
          {error ? <p className="muted" style={{ margin: 0 }}>{error}</p> : null}
          {!loading && !error && comments.length === 0 ? <p className="muted" style={{ margin: 0 }}>Sin respuestas aún.</p> : null}
          {!loading && !error && comments.length > 0 ? (
            <div style={{ display: "grid", gap: 8 }}>
              {comments.map((comment) => {
                const user = pickUser(comment.users);
                return (
                  <div key={comment.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <img
                      src={user?.avatar_url ?? "/logo.png"}
                      alt={user?.nickname ?? "avatar"}
                      width={24}
                      height={24}
                      style={{ borderRadius: "50%", objectFit: "cover" }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.nickname ?? "Anónimo"}</div>
                      <div className="muted" style={{ fontSize: 13 }}>{comment.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

