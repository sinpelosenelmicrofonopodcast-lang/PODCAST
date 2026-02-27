import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { supabaseServer } from "@/lib/supabaseServer";
import { newsHref } from "@/lib/newsRoute";

export const revalidate = 300;

type NewsItem = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string | null;
  cover_url: string | null;
  published_at: string | null;
};

type BlogItem = {
  id: string;
  slug: string | null;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  created_at: string | null;
  categories: string[] | null;
  tags: string[] | null;
};

function normalize(value: string) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-PR", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function postHref(post: { id: string; slug?: string | null }) {
  const slug = String(post.slug ?? "").trim();
  return `/blog/${slug || post.id}`;
}

export default async function EmprendimientoPage() {
  const supabase = supabaseServer();

  let newsItems: NewsItem[] = [];
  {
    let query = supabase
      .from("news_items")
      .select("id, slug, title, summary, cover_url, published_at")
      .eq("publication_state", "published")
      .contains("categories", ["Emprendimiento"])
      .order("published_at", { ascending: false })
      .limit(16);
    let { data, error } = await query;
    if (error && /publication_state/i.test(error.message)) {
      const fallback = await supabase
        .from("news_items")
        .select("id, slug, title, summary, cover_url, published_at")
        .contains("categories", ["Emprendimiento"])
        .order("published_at", { ascending: false })
        .limit(16);
      data = fallback.data;
    }
    newsItems = (data as NewsItem[]) ?? [];
  }

  let blogItems: BlogItem[] = [];
  {
    const { data } = await supabase
      .from("blog_posts")
      .select("id, slug, title, excerpt, cover_url, created_at, categories, tags")
      .order("created_at", { ascending: false })
      .limit(60);

    const needles = new Set(["emprendimiento", "emprender", "pyme", "negocio", "startup", "small business"]);
    blogItems = ((data as BlogItem[]) ?? [])
      .filter((item) => {
        const cats = (item.categories ?? []).map(normalize);
        const tags = (item.tags ?? []).map(normalize);
        const textBag = new Set([...cats, ...tags]);
        return Array.from(needles).some((needle) => textBag.has(needle));
      })
      .slice(0, 12);
  }

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container" style={{ display: "grid", gap: 18 }}>
          <div className="card" style={{ display: "grid", gap: 10 }}>
            <span className="news-badge">Segmento</span>
            <h1 className="section-title" style={{ margin: 0 }}>
              Emprendimiento
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              Historias de negocios pequeños, pymes y gente construyendo proyectos reales.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link className="button secondary" href="/noticias?cat=Emprendimiento">
                Ver noticias de emprendimiento
              </Link>
              <Link className="button secondary" href="/blog?cat=Emprendimiento">
                Ver blogs de emprendimiento
              </Link>
            </div>
          </div>

          <MidContentAdSlot placement="section_header" section="emprendimiento" className="section-ad-slot" compact />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 14 }}>
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Últimas noticias</h2>
              {newsItems.length === 0 ? <p className="muted">No hay noticias de emprendimiento todavía.</p> : null}
              <div className="list">
                {newsItems.map((item) => (
                  <article key={item.id} className="card">
                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 10 }}
                      />
                    ) : null}
                    <h3 style={{ margin: "10px 0 6px" }}>{item.title}</h3>
                    {item.summary ? <p className="muted">{item.summary}</p> : null}
                    <p className="muted" style={{ marginBottom: 8 }}>
                      {formatDate(item.published_at)}
                    </p>
                    <Link className="button secondary" href={newsHref(item)}>
                      Leer noticia
                    </Link>
                  </article>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 style={{ marginTop: 0 }}>Historias en blog</h2>
              {blogItems.length === 0 ? <p className="muted">No hay historias en blog todavía.</p> : null}
              <div className="list">
                {blogItems.map((item) => (
                  <article key={item.id} className="card">
                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt={item.title}
                        style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 10 }}
                      />
                    ) : null}
                    <h3 style={{ margin: "10px 0 6px" }}>{item.title}</h3>
                    {item.excerpt ? <p className="muted">{item.excerpt}</p> : null}
                    <p className="muted" style={{ marginBottom: 8 }}>
                      {formatDate(item.created_at)}
                    </p>
                    <Link className="button secondary" href={postHref(item) as any}>
                      Leer blog
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
