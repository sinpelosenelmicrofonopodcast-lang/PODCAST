"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { useProtectedUser } from "@/lib/useProtectedUser";

type UserRow = {
  id: string;
  nickname: string;
  bio: string | null;
  avatar_url: string | null;
};

type ThreadRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string | null;
};

export default function PublicProfilePage() {
  const { checking, userId } = useProtectedUser();
  const params = useParams<{ nickname: string }>();
  const nickname = String(params?.nickname ?? "");

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<UserRow | null>(null);
  const [threads, setThreads] = useState<ThreadRow[]>([]);

  useEffect(() => {
    if (!userId || !nickname) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data: profile } = await supabase
        .from("users")
        .select("id, nickname, bio, avatar_url")
        .eq("nickname", nickname)
        .limit(1)
        .maybeSingle();

      if (!mounted) return;
      const p = (profile as UserRow | null) ?? null;
      setUser(p);

      if (!p?.id) {
        setThreads([]);
        setLoading(false);
        return;
      }

      const { data: rows } = await supabase
        .from("threads")
        .select("id, title, body, created_at")
        .eq("author_id", p.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!mounted) return;
      setThreads((rows as ThreadRow[]) ?? []);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [nickname, userId]);

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          {checking || loading ? (
            <div className="card">
              <p className="muted">Cargando perfil...</p>
            </div>
          ) : null}

          {!checking && !loading ? (
            user ? (
              <div className="card" style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <img
                    src={user.avatar_url ?? "/logo.png"}
                    alt={user.nickname}
                    width={88}
                    height={88}
                    style={{ borderRadius: "50%", objectFit: "cover" }}
                  />
                  <div>
                    <h1 style={{ margin: 0 }}>{user.nickname}</h1>
                    <p className="muted" style={{ marginTop: 6 }}>
                      {user.bio || "Sin bio por ahora."}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="card">
                <p className="muted">Perfil no encontrado.</p>
              </div>
            )
          ) : null}
        </div>
      </section>

      {user && !checking && !loading ? (
        <section className="section">
          <div className="container">
            <h2 className="section-title">Posts recientes</h2>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 20 }}>
              {threads.length > 0 ? (
                threads.map((thread) => (
                  <div key={thread.id} className="card">
                    <h3 style={{ marginTop: 0 }}>{thread.title}</h3>
                    <p className="muted">{thread.body}</p>
                  </div>
                ))
              ) : (
                <div className="card">
                  <p className="muted">Aún no hay publicaciones.</p>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <Footer />
    </main>
  );
}

