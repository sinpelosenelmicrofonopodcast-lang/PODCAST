"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { CommunityComposer } from "@/components/CommunityComposer";
import { ReplyComposer } from "@/components/ReplyComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { LazyThreadReplies } from "@/components/LazyThreadReplies";
import { supabase } from "@/lib/supabaseClient";
import { useProtectedUser } from "@/lib/useProtectedUser";

type ThreadRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string | null;
  users: { nickname?: string | null; bio?: string | null; avatar_url?: string | null } | { nickname?: string | null; bio?: string | null; avatar_url?: string | null }[] | null;
};

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

function formatDate(value: string | null) {
  if (!value) return "Reciente";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default function CommunityPage() {
  const { checking, userId } = useProtectedUser();
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [replyCountByThread, setReplyCountByThread] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("threads")
        .select("id, title, body, created_at, users(nickname, bio, avatar_url)")
        .eq("space", "community")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!mounted) return;
      const items = (data as ThreadRow[]) ?? [];
      setThreads(items);

      const ids = items.map((x) => x.id);
      if (ids.length === 0) {
        setReplyCountByThread(new Map());
        setLoading(false);
        return;
      }

      const { data: replies } = await supabase
        .from("replies")
        .select("id, thread_id")
        .in("thread_id", ids)
        .limit(2000);

      if (!mounted) return;
      const counts = new Map<string, number>();
      (replies ?? []).forEach((r: any) => counts.set(r.thread_id, (counts.get(r.thread_id) ?? 0) + 1));
      setReplyCountByThread(counts);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container community-shell">
          <header className="page-header-card community-header">
            <div className="page-header-content">
              <p className="page-kicker">Comunidad privada</p>
              <h1 className="section-title page-title">Comunidad</h1>
              <p className="page-lead">Threads, respuestas y conversación directa entre usuarios registrados.</p>
              <div className="page-meta-list">
                <span>{threads.length} conversaciones abiertas</span>
                <span>{replyCountByThread.size} con respuestas</span>
              </div>
            </div>
            <div className="community-header-panel">
              <strong>Flujo recomendado</strong>
              <p className="muted">Abre un tema con contexto, revisa respuestas y sigue el hilo sin duplicar conversaciones.</p>
            </div>
          </header>

          {!checking && userId ? <CommunityComposer /> : null}

          {checking || loading ? (
            <div className="card state-card">
              <p className="muted">Cargando comunidad...</p>
            </div>
          ) : null}

          {!checking && !loading && threads.length > 0 ? (
            <div className="thread-grid">
              {threads.map((thread) => {
                const user = pickUser(thread.users);
                const repliesCount = replyCountByThread.get(thread.id) ?? 0;
                return (
                  <article key={thread.id} className="card thread-card">
                    <div className="thread-card-head">
                      <div className="thread-author">
                        <img
                          src={user?.avatar_url ?? "/logo.png"}
                          alt={user?.nickname ?? "avatar"}
                          width={40}
                          height={40}
                          className="thread-avatar"
                        />
                        <div>
                          <div className="thread-author-name">{user?.nickname ?? "Anónimo"}</div>
                          <div className="muted thread-author-meta">
                            {user?.bio ?? "Miembro de la comunidad"} · {formatDate(thread.created_at)}
                          </div>
                        </div>
                      </div>
                      <span className="thread-count-chip">{repliesCount} respuestas</span>
                    </div>
                    <div className="thread-card-body">
                      <h3>{thread.title}</h3>
                      <p className="muted">{thread.body ?? ""}</p>
                    </div>
                    <AdminDeleteButton table="threads" id={thread.id} label="Eliminar thread" />
                    <div className="thread-card-footer">
                      <LazyThreadReplies threadId={thread.id} initialCount={repliesCount} />
                      <ReplyComposer threadId={thread.id} />
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!checking && !loading && threads.length === 0 ? (
            <div className="card state-card">
              <h2>Comunidad lista para arrancar</h2>
              <p className="muted">Todavía no hay threads publicados. Abre el primero con una pregunta clara o una postura fuerte.</p>
            </div>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}
