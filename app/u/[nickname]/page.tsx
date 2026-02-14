import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";

export default async function PublicProfilePage({ params }: { params: { nickname: string } }) {
  const supabase = supabaseServer();
  const { data: user } = await supabase
    .from("users")
    .select("id, nickname, bio, avatar_url")
    .eq("nickname", params.nickname)
    .single();

  const { data: threads } = await supabase
    .from("threads")
    .select("id, title, body, created_at")
    .eq("author_id", user?.id ?? "")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          {user ? (
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
          )}
        </div>
      </section>

      {user ? (
        <section className="section">
          <div className="container">
            <h2 className="section-title">Posts recientes</h2>
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 20 }}>
              {threads && threads.length > 0 ? (
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
