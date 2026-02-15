import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthWall } from "@/components/AuthWall";
import { supabaseServer } from "@/lib/supabaseServer";
import { ConfesionComposer } from "@/components/ConfesionComposer";
import { CommentComposer } from "@/components/CommentComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

export default async function ConfesionesPage() {
  const supabase = supabaseServer();
  const bannerUrl = (process.env.NEXT_PUBLIC_CONFESIONARIO_BANNER_URL ?? "").trim();
  const { data } = await supabase
    .from("confessions")
    .select("id, body, created_at, users(nickname, avatar_url)")
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
      <AuthWall />
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
          <ConfesionComposer />
          {data && data.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 20 }}>
              {data.map((item) => {
                const replies = commentsByContent.get(item.id) ?? [];
                const author = pickUser((item as any).users);
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
