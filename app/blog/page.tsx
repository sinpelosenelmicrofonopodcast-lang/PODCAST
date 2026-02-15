import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { ShareButtons } from "@/components/ShareButtons";
import Link from "next/link";
import { ui } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18nServer";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BlogPage() {
  const supabase = supabaseServer();
  const lang = getServerLang();
  const t = ui[lang];
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
          <h1 className="section-title">{t.blog.title}</h1>
          <p className="muted">{t.blog.subtitle}</p>
          {data && data.length > 0 ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 20 }}>
              {data.map((post, idx) => (
                <div key={post.id} style={{ display: "contents" }}>
                  {idx === 3 ? <MidContentAdSlot /> : null}
                  <div className="card" style={{ display: "grid", gap: 12 }}>
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
                      {t.common.read}
                    </Link>
                    <ShareButtons path={`/blog/${post.id}`} text={post.title} />
                  </div>
                </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">{t.blog.noneYet}</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
