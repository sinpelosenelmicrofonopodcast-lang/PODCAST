import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { CommunityComposer } from "@/components/CommunityComposer";
import { ReplyComposer } from "@/components/ReplyComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

export default async function CommunityPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("threads")
    .select(
      "id, title, body, created_at, users(nickname, bio, avatar_url), replies(id, body, created_at, users(nickname, avatar_url))"
    )
    .eq("space", "community")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Comunidad</h1>
          <p className="muted">Threads, replies y reacciones con reputación real.</p>
          <CommunityComposer />
          {data && data.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", marginTop: 20 }}>
              {data.map((thread) => {
                const user = pickUser(thread.users);
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
                        Respuestas: {thread.replies?.length ?? 0}
                      </div>
                      {thread.replies && thread.replies.length > 0 ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          {thread.replies.map((reply) => {
                            const replyUser = pickUser(reply.users);
                            return (
                              <div key={reply.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <img
                                  src={replyUser?.avatar_url ?? "/logo.png"}
                                  alt={replyUser?.nickname ?? "avatar"}
                                  width={24}
                                  height={24}
                                  style={{ borderRadius: "50%", objectFit: "cover" }}
                                />
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{replyUser?.nickname ?? "Anónimo"}</div>
                                  <div className="muted" style={{ fontSize: 13 }}>{reply.body}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      <ReplyComposer threadId={thread.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Todavía no hay threads en comunidad. Sé el primero en iniciar.</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
