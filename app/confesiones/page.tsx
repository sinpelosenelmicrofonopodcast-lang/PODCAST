import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { ConfesionComposer } from "@/components/ConfesionComposer";
import { CommentComposer } from "@/components/CommentComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ConfesionesPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("confessions")
    .select("id, body, created_at")
    .eq("level", "public")
    .order("created_at", { ascending: false })
    .limit(20);

  const ids = (data ?? []).map((item) => item.id);
  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, content_id, created_at, users(nickname, avatar_url)")
    .eq("content_type", "confession")
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
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Confesiones</h1>
          <div className="card" style={{ marginTop: 18 }}>
            <p className="muted" style={{ marginTop: 0 }}>
              “Esto no es terapia. Es realidad compartida.”
            </p>
            <p>Área pública con moderación. Zona paga con confesiones crudas y respuestas sin filtro.</p>
          </div>
          <ConfesionComposer />
          {data && data.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 20 }}>
              {data.map((item) => {
                const replies = commentsByContent.get(item.id) ?? [];
                return (
                  <div key={item.id} className="card" style={{ display: "grid", gap: 12 }}>
                    <h3>Confesión</h3>
                    <p className="muted">{item.body}</p>
                    <AdminDeleteButton table="confessions" id={item.id} label="Eliminar confesión" />
                    <div>
                      <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                        Respuestas: {replies.length}
                      </div>
                      {replies.length > 0 ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {replies.map((reply) => (
                            <div key={reply.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <img
                                src={reply.users?.avatar_url ?? "/logo.png"}
                                alt={reply.users?.nickname ?? "avatar"}
                                width={24}
                                height={24}
                                style={{ borderRadius: "50%", objectFit: "cover" }}
                              />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{reply.users?.nickname ?? "Anónimo"}</div>
                                <div className="muted" style={{ fontSize: 13 }}>{reply.body}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <CommentComposer contentId={item.id} contentType="confession" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Aún no hay confesiones públicas publicadas.</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
