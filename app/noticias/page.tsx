import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { supabaseServer } from "@/lib/supabaseServer";
import { newsCategories } from "@/lib/newsCategories";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NoticiasPage({ searchParams }: { searchParams: { cat?: string; sort?: string } }) {
  const supabase = supabaseServer();
  const category = searchParams?.cat;
  const sort = searchParams?.sort ?? "latest";

  let query = supabase
    .from("news_items")
    .select("id, title, summary, published_at, cover_url, categories")
    .order("published_at", { ascending: false });

  if (category) {
    query = query.contains("categories", [category]);
  }

  const { data } = await query.limit(50);

  let items = data ?? [];

  if (sort === "comments" && items.length > 0) {
    const ids = items.map((item) => item.id);
    const { data: comments } = await supabase
      .from("comments")
      .select("id, content_id")
      .eq("content_type", "news")
      .in("content_id", ids);

    const counts = new Map<string, number>();
    (comments ?? []).forEach((c) => counts.set(c.content_id, (counts.get(c.content_id) ?? 0) + 1));
    items = [...items].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  }

  const tabClass = (active: boolean) => (active ? "news-tab active" : "news-tab");
  const buildNewsHref = (nextSort: string) => ({
    pathname: "/noticias",
    query: {
      ...(category ? { cat: category } : {}),
      sort: nextSort
    }
  });

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Noticias Sin Pelos</h1>
          <p className="muted">Curaduría manual con análisis propio.</p>

          <div className="news-tabs">
            <Link className={tabClass(!category)} href="/noticias">
              Todas
            </Link>
            {newsCategories.map((cat) => (
              <Link key={cat} className={tabClass(category === cat)} href={`/noticias?cat=${encodeURIComponent(cat)}&sort=${sort}`}>
                {cat}
              </Link>
            ))}
          </div>

          <div className="news-tabs" style={{ marginTop: 12 }}>
            <Link className={tabClass(sort === "all" || sort === "latest")} href={buildNewsHref("latest")}>
              Últimas
            </Link>
            <Link className={tabClass(sort === "comments")} href={buildNewsHref("comments")}>
              Más comentadas
            </Link>
          </div>

          {items && items.length > 0 ? (
            <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
              {items.map((item) => (
                <div
                  key={item.id}
                  className="card"
                  style={{
                    display: "grid",
                    gridTemplateColumns: item.cover_url ? "160px 1fr" : "1fr",
                    gap: 14,
                    alignItems: "center"
                  }}
                >
                  {item.cover_url ? (
                    <Link href={`/noticias/${item.id}`}>
                      <div className="news-cover-thumb">
                        <img src={item.cover_url} alt={item.title} />
                      </div>
                    </Link>
                  ) : null}
                  <div style={{ display: "grid", gap: 8 }}>
                    <div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {(item.categories ?? []).map((cat: string) => (
                          <span key={cat} className="news-badge">
                            {cat}
                          </span>
                        ))}
                        <span className="muted" style={{ fontSize: 12 }}>
                          {new Date(item.published_at).toLocaleDateString("es-PR")}
                        </span>
                      </div>
                      <Link href={`/noticias/${item.id}`}>
                        <h3 className="news-title-clamp" style={{ margin: "6px 0 0" }}>
                          {item.title}
                        </h3>
                      </Link>
                    </div>
                    {item.summary ? (
                      <p className="muted news-summary-clamp" style={{ margin: 0 }}>
                        {item.summary}
                      </p>
                    ) : null}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Link className="button secondary" href={`/noticias/${item.id}`}>
                        Leer
                      </Link>
                      <ShareButtons path={`/noticias/${item.id}`} text={item.title} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">No hay noticias cargadas aún.</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
