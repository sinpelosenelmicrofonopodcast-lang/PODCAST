"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { TeoriaComposer } from "@/components/TeoriaComposer";
import { CommentComposer } from "@/components/CommentComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { LazyContentComments } from "@/components/LazyContentComments";
import { supabase } from "@/lib/supabaseClient";
import { useProtectedUser } from "@/lib/useProtectedUser";

type TheoryRow = {
  id: string;
  theory: string;
  opinion: string | null;
  question: string | null;
  subcategory: string | null;
  created_at: string | null;
};

export default function TeoriasPage() {
  const { checking, userId } = useProtectedUser();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TheoryRow[]>([]);
  const [commentsCountByContent, setCommentsCountByContent] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("theories")
        .select("id, theory, opinion, question, subcategory, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!mounted) return;
      const rows = (data as TheoryRow[]) ?? [];
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
        .eq("content_type", "theory")
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
          <h1 className="section-title">Teorías de Conspiración</h1>
          <p className="muted">
            Formato obligatorio: Teoría · Fuente · Opinión personal · Pregunta abierta. Objetivo: pensar, no repetir memes.
          </p>

          {!checking && userId ? <TeoriaComposer /> : null}

          {checking || loading ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Cargando teorías...</p>
            </div>
          ) : null}

          {!checking && !loading && items.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 20 }}>
              {items.map((item) => {
                const repliesCount = commentsCountByContent.get(item.id) ?? 0;
                return (
                  <div key={item.id} className="card" style={{ display: "grid", gap: 12 }}>
                    <h3 style={{ marginTop: 0 }}>{item.theory}</h3>
                    <p className="muted">{item.opinion}</p>
                    <p className="muted">Pregunta: {item.question}</p>
                    <span className="badge">{item.subcategory ?? "General"}</span>
                    <AdminDeleteButton table="theories" id={item.id} label="Eliminar teoría" />
                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                        Respuestas: {repliesCount}
                      </div>
                      <LazyContentComments contentId={item.id} contentType="theory" initialCount={repliesCount} />
                      <CommentComposer contentId={item.id} contentType="theory" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {!checking && !loading && items.length === 0 ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Aún no hay teorías publicadas.</p>
            </div>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}

