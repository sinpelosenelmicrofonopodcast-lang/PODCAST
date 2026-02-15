import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { supabaseServer } from "@/lib/supabaseServer";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function BlogPostPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const id = String(params?.id ?? "").trim();

  const { data } = await supabase
    .from("blog_posts")
    .select("id, title, excerpt, body, cover_url, created_at")
    .eq("id", id)
    .single();

  if (!data) {
    return (
      <main>
        <Navbar />
        <section className="section">
          <div className="container">
            <div className="card">
              <h1 className="section-title" style={{ marginTop: 0 }}>
                No encontrado
              </h1>
              <p className="muted">Este artículo no existe o fue eliminado.</p>
              <Link className="button secondary" href="/blog">
                Volver al blog
              </Link>
            </div>
          </div>
        </section>
        <Footer />
      </main>
    );
  }

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <Link className="button secondary" href="/blog">
                Volver
              </Link>
              <ShareButtons path={`/blog/${data.id}`} text={data.title} />
            </div>

            {data.cover_url ? (
              <div className="news-cover-full" style={{ marginTop: 14 }}>
                <img src={data.cover_url} alt={data.title} />
              </div>
            ) : null}

            <h1 className="section-title" style={{ marginTop: 18 }}>
              {data.title}
            </h1>
            {data.created_at ? (
              <p className="muted" style={{ marginTop: 0 }}>
                {new Date(data.created_at).toLocaleDateString("es-PR")}
              </p>
            ) : null}

            {data.excerpt ? (
              <p className="muted" style={{ fontSize: 16 }}>
                {data.excerpt}
              </p>
            ) : null}

            {(() => {
              const text = String(data.body ?? "").trim();
              if (!text) return <div className="post-body" style={{ whiteSpace: "pre-wrap", lineHeight: 1.65 }} />;
              const parts = text.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
              const insertAfter = parts.length >= 3 ? 2 : 1;
              return (
                <div className="post-body article-body">
                  {parts.map((p, idx) => (
                    <div key={idx}>
                      <p>{p}</p>
                      {idx === insertAfter ? <MidContentAdSlot /> : null}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
