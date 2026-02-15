import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthWall } from "@/components/AuthWall";
import { supabaseServer } from "@/lib/supabaseServer";
import { TeoriaComposer } from "@/components/TeoriaComposer";
import { CommentComposer } from "@/components/CommentComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

export default async function TeoriasPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("theories")
    .select("id, theory, opinion, question, subcategory, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  const ids = (data ?? []).map((item) => item.id);
  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, content_id, created_at, users(nickname, avatar_url)")
    .eq("content_type", "theory")
    .in("content_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"])
    .order("created_at", { ascending: true });

  const commentsByContent = new Map<string, any[]>();
  (comments ?? []).forEach((comment) => {
    const list = commentsByContent.get(comment.content_id) ?? [];
    list.push(comment);
    commentsByContent.set(comment.content_id, list);
  });

  return (
    <main>
      <AuthWall />
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Teorías de Conspiración</h1>
          <p className="muted">
            Formato obligatorio: Teoría · Fuente · Opinión personal · Pregunta abierta. Objetivo: pensar, no repetir memes.
          </p>
          <TeoriaComposer />
          {data && data.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 20 }}>
              {data.map((item) => {
                const replies = commentsByContent.get(item.id) ?? [];
                return (
                  <div key={item.id} className="card" style={{ display: "grid", gap: 12 }}>
                    <h3 style={{ marginTop: 0 }}>{item.theory}</h3>
                    <p className="muted">{item.opinion}</p>
                    <p className="muted">Pregunta: {item.question}</p>
                    <span className="badge">{item.subcategory ?? "General"}</span>
                    <AdminDeleteButton table="theories" id={item.id} label="Eliminar teoría" />
                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                        Respuestas: {replies.length}
                      </div>
                      {replies.length > 0 ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {replies.map((reply) => {
                            const user = pickUser(reply.users);
                            return (
                              <div key={reply.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <img
                                  src={user?.avatar_url ?? "/logo.png"}
                                  alt={user?.nickname ?? "avatar"}
                                  width={24}
                                  height={24}
                                  style={{ borderRadius: "50%", objectFit: "cover" }}
                                />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.nickname ?? "Anónimo"}</div>
                                  <div className="muted" style={{ fontSize: 13 }}>{reply.body}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      <CommentComposer contentId={item.id} contentType="theory" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Aún no hay teorías publicadas.</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
