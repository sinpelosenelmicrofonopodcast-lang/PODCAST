"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type ReplyRow = {
  id: string;
  body: string;
  created_at: string | null;
  users: { nickname?: string | null; avatar_url?: string | null } | { nickname?: string | null; avatar_url?: string | null }[] | null;
};

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

export function LazyThreadReplies({ threadId, initialCount = 0 }: { threadId: string; initialCount?: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [replies, setReplies] = useState<ReplyRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadReplies = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("replies")
      .select("id, body, created_at, users(nickname, avatar_url)")
      .eq("thread_id", threadId)
      .order("created_at", { ascending: true })
      .limit(80);

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    setReplies((data as ReplyRow[]) ?? []);
    setLoaded(true);
    setLoading(false);
  };

  const onToggle = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && !loaded && !loading) await loadReplies();
  };

  return (
    <div className="thread-replies">
      <button className="button secondary" type="button" onClick={onToggle}>
        {open ? "Ocultar respuestas" : `Ver respuestas (${initialCount})`}
      </button>
      {open ? (
        <div className="thread-replies-body">
          {loading ? <p className="muted thread-replies-status">Cargando respuestas...</p> : null}
          {error ? <p className="status-text error">{error}</p> : null}
          {!loading && !error && replies.length === 0 ? <p className="muted thread-replies-status">Sin respuestas aún.</p> : null}
          {!loading && !error && replies.length > 0 ? (
            <div className="thread-reply-list">
              {replies.map((reply) => {
                const user = pickUser(reply.users);
                return (
                  <div key={reply.id} className="thread-reply-item">
                    <img
                      src={user?.avatar_url ?? "/logo.png"}
                      alt={user?.nickname ?? "avatar"}
                      width={24}
                      height={24}
                      className="thread-reply-avatar"
                    />
                    <div className="thread-reply-copy">
                      <div className="thread-reply-author">{user?.nickname ?? "Anónimo"}</div>
                      <div className="muted">{reply.body}</div>
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
