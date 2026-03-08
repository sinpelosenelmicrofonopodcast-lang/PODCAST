import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Memes virales | Sin Pelos en el Micrófono",
  description: "Memes editoriales y piezas virales de la redacción Sin Pelos.",
  path: "/memes"
});

export default async function MemesPage() {
  const supabase = supabaseServer();
  const { data } = await supabase
    .from("news_articles")
    .select("id, slug, title, meme_image_url, summary")
    .eq("status", "published")
    .not("meme_image_url", "is", null)
    .order("published_at", { ascending: false })
    .limit(40);

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Memes</h1>
          <p className="muted">Humor con contexto. Directo. Boricua. Viral.</p>
          <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            {(data ?? []).map((item: any) => (
              <article key={item.id} className="card" style={{ display: "grid", gap: 8 }}>
                {item.meme_image_url ? (
                  <img src={item.meme_image_url} alt={item.title} style={{ width: "100%", aspectRatio: "4 / 5", objectFit: "contain", background: "#110" }} loading="lazy" />
                ) : null}
                <strong>{item.title}</strong>
                <p className="muted" style={{ margin: 0 }}>{item.summary ?? "—"}</p>
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
