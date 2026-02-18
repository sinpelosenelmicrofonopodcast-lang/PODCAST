"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ConfesionComposer } from "@/components/ConfesionComposer";
import { CommentComposer } from "@/components/CommentComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { LazyContentComments } from "@/components/LazyContentComments";
import { supabase } from "@/lib/supabaseClient";
import { useProtectedUser } from "@/lib/useProtectedUser";

type ConfessionRow = {
  id: string;
  body: string;
  created_at: string | null;
  users: { nickname?: string | null; avatar_url?: string | null } | { nickname?: string | null; avatar_url?: string | null }[] | null;
};

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

export default function ConfesionesPage() {
  const { checking, userId } = useProtectedUser();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ConfessionRow[]>([]);
  const [commentsCountByContent, setCommentsCountByContent] = useState<Map<string, number>>(new Map());
  const bannerUrl = (process.env.NEXT_PUBLIC_CONFESIONARIO_BANNER_URL ?? "").trim();

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("confessions")
        .select("id, body, created_at, users(nickname, avatar_url)")
        .eq("level", "public")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!mounted) return;
      const rows = (data as ConfessionRow[]) ?? [];
      setItems(rows);

      const ids = rows.map((x) => x.id);
      if (ids.length === 0) {
        setCommentsCountByContent(new Map());
        setLoading(false);
        return;
      }

      const { data: comments } = await supabase
        .from("comments")
        .select("id, content_id")
        .eq("content_type", "confession")
        .in("content_id", ids)
        .limit(2000);

      if (!mounted) return;
      const counts = new Map<string, number>();
      (comments ?? []).forEach((r: any) => counts.set(r.content_id, (counts.get(r.content_id) ?? 0) + 1));
      setCommentsCountByContent(counts);
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
          <div className="confesionario-hero card">
            <div
              className="confesionario-banner"
              aria-hidden="true"
              style={
                bannerUrl
                  ? ({
                      ["--confesionario-banner-layer" as any]: `url("${bannerUrl}")`
                    } as any)
                  : undefined
              }
            />
            <div className="confesionario-overlay">
              <span className="badge">Sección exclusiva</span>
              <h1 className="section-title" style={{ margin: 0 }}>
                El Confesionario Sin Pelos
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                “Esto no es terapia. Es realidad compartida.”
              </p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 18 }}>
            <h3 style={{ marginTop: 0 }}>Reglas del confesionario</h3>
            <p>Área pública con moderación. Zona paga con confesiones crudas y respuestas sin filtro.</p>
          </div>

          {!checking && userId ? <ConfesionComposer /> : null}

          {checking || loading ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Cargando confesiones...</p>
            </div>
          ) : null}

          {!checking && !loading && items.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 20 }}>
              {items.map((item) => {
                const author = pickUser(item.users);
                const repliesCount = commentsCountByContent.get(item.id) ?? 0;
                return (
                  <div key={item.id} className="card" style={{ display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <img
                        src={author?.avatar_url ?? "/logo.png"}
                        alt={author?.nickname ?? "avatar"}
                        width={30}
                        height={30}
                        style={{ borderRadius: "50%", objectFit: "cover" }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{author?.nickname ?? "Anónimo"}</div>
                        <div className="muted" style={{ fontSize: 12 }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString("es-PR") : ""}
                        </div>
                      </div>
                    </div>
                    <h3>Confesión</h3>
                    <p className="muted">{item.body}</p>
                    <AdminDeleteButton table="confessions" id={item.id} label="Eliminar confesión" />
                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                        Respuestas: {repliesCount}
                      </div>
                      <LazyContentComments contentId={item.id} contentType="confession" initialCount={repliesCount} />
                      <CommentComposer contentId={item.id} contentType="confession" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!checking && !loading && items.length === 0 ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Aún no hay confesiones públicas publicadas.</p>
            </div>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}

