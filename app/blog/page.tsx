import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { ShareButtons } from "@/components/ShareButtons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BlogPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("blog_posts")
    .select("id, title, excerpt, created_at, cover_url")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Blog Sin Pelos</h1>
          <p className="muted">Artículos largos, análisis y opinión profunda.</p>
          {data && data.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 20 }}>
              {data.map((post) => (
                <div key={post.id} className="card" style={{ display: "grid", gap: 12 }}>
                  {post.cover_url ? (
                    <img
                      src={post.cover_url}
                      alt={post.title}
                      style={{ width: "100%", borderRadius: 12, objectFit: "cover" }}
                    />
                  ) : null}
                  <h3 style={{ marginTop: 0 }}>{post.title}</h3>
                  <p className="muted">{post.excerpt ?? ""}</p>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {post.created_at ? new Date(post.created_at).toLocaleDateString("es-PR") : ""}
                  </span>
                  <ShareButtons path={`/blog`} text={post.title} />
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">No hay artículos aún.</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
