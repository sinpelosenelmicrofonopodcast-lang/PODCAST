import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { ShareButtons } from "@/components/ShareButtons";
import Link from "next/link";

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
                      className="cover-news"
                    />
                  ) : null}
                  <h3 className="blog-title-clamp" style={{ marginTop: 0 }}>
                    {post.title}
                  </h3>
                  <p className="muted blog-excerpt-clamp" style={{ margin: 0 }}>
                    {post.excerpt ?? ""}
                  </p>
                  <span className="muted" style={{ fontSize: 12 }}>
                    {post.created_at ? new Date(post.created_at).toLocaleDateString("es-PR") : ""}
                  </span>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <Link className="button secondary" href={`/blog/${post.id}`}>
                      Leer
                    </Link>
                    <ShareButtons path={`/blog/${post.id}`} text={post.title} />
                  </div>
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
