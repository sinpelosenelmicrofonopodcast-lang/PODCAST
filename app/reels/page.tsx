import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Reels y clips | Sin Pelos en el Micrófono",
  description: "Guiones, clips y metadata de reels para noticias y podcast.",
  path: "/reels"
});

export default async function ReelsPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("news_articles")
    .select("id, slug, title, summary, reel_video_url, reel_script, quote_card_url")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []).filter((item: any) => item.reel_video_url || item.reel_script || item.quote_card_url);

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Reels</h1>
          <p className="muted">Hooks, scripts y clips listos para distribución social.</p>
          <div className="list" style={{ marginTop: 16 }}>
            {rows.map((item: any) => (
              <article key={item.id} className="card" style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                  <strong>{item.title}</strong>
                  <Link className="button secondary" href={`/noticias/${encodeURIComponent(item.slug ?? item.id)}`}>Abrir</Link>
                </div>
                {item.reel_script ? <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 13 }}>{item.reel_script}</pre> : null}
                {item.reel_video_url ? <a className="muted" href={item.reel_video_url} target="_blank" rel="noreferrer">Video reel</a> : null}
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
