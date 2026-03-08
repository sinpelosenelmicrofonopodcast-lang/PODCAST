import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Bochinche viral | Sin Pelos en el Micrófono",
  description: "Feed viral mixto: noticias, tendencias, memes y contenido de alto engagement.",
  path: "/bochinche"
});

export default async function BochinchePage() {
  const supabase = supabaseServer();

  const { data } = await supabase
    .from("news_articles")
    .select("id, slug, title, summary, cover_image_url, category, region, trending_score, engagement_score, published_at")
    .eq("status", "published")
    .order("trending_score", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(80);

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Bochinche</h1>
          <p className="muted">Lo más caliente: 70% trending, 20% nuevo, 10% exploración.</p>
          <div className="list" style={{ marginTop: 16 }}>
            {(data ?? []).map((item: any) => (
              <article key={item.id} className="card" style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{item.title}</strong>
                  <span className="news-badge">{Number(item.trending_score ?? 0).toFixed(1)}</span>
                </div>
                {item.cover_image_url ? (
                  <img src={item.cover_image_url} alt={item.title} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "contain", background: "#110" }} loading="lazy" />
                ) : null}
                <p className="muted" style={{ margin: 0 }}>{item.summary ?? "—"}</p>
                <p className="muted" style={{ margin: 0 }}>
                  {item.category ?? "Noticias"} · {item.region ?? "Mundo"} · engagement {Number(item.engagement_score ?? 0).toFixed(1)}
                </p>
                <Link className="button secondary" href={`/noticias/${encodeURIComponent(item.slug ?? item.id)}`}>Abrir noticia</Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
