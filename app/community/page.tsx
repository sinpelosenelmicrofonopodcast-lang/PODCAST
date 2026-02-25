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
        <div className="container">
          <h1 className="section-title">Comunidad</h1>
          <p className="muted">Threads, replies y reacciones con reputación real.</p>
          {!checking && userId ? <CommunityComposer /> : null}

          {checking || loading ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Cargando comunidad...</p>
            </div>
          ) : null}

          {!checking && !loading && threads.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", marginTop: 20 }}>
              {threads.map((thread) => {
                const user = pickUser(thread.users);
                const repliesCount = replyCountByThread.get(thread.id) ?? 0;
                return (
                  <div key={thread.id} className="card" style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <img
                        src={user?.avatar_url ?? "/logo.png"}
                        alt={user?.nickname ?? "avatar"}
                        width={36}
                        height={36}
                        style={{ borderRadius: "50%", objectFit: "cover" }}
                      />
                      <div>
                        <div style={{ fontWeight: 700 }}>{user?.nickname ?? "Anónimo"}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {user?.bio ?? "Sin bio"}
                        </div>
                      </div>
                    </div>
                    <div>
                      <h3 style={{ marginTop: 0 }}>{thread.title}</h3>
                      <p className="muted">{thread.body ?? ""}</p>
                    </div>
                    <AdminDeleteButton table="threads" id={thread.id} label="Eliminar thread" />
                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                        Respuestas: {repliesCount}
                      </div>
                      <LazyThreadReplies threadId={thread.id} initialCount={repliesCount} />
                      <ReplyComposer threadId={thread.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!checking && !loading && threads.length === 0 ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Todavía no hay threads en comunidad. Sé el primero en iniciar.</p>
            </div>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}
