import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { Callout } from "@/components/blog/Callout";
import { ProblemTrio } from "@/components/blog/ProblemTrio";
import { supabaseServer } from "@/lib/supabaseServer";
import { clampMetaDescription, estimateReadingTimeMinutes } from "@/lib/blogSeo";
import { parseBlogBlocks } from "@/lib/blogContent";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type BlogPost = {
  id: string;
  slug?: string | null;
  title: string;
  excerpt: string | null;
  meta_description?: string | null;
  body: string | null;
  cover_url: string | null;
  created_at: string | null;
  updated_at?: string | null;
  reading_time_minutes?: number | null;
  categories?: string[] | null;
  tags?: string[] | null;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", { year: "numeric", month: "short", day: "2-digit" });
}

function safeOrValue(v: string) {
  // PostgREST "or" filters are comma-separated; keep it simple and safe.
  return String(v ?? "").trim().replace(/,/g, "");
}

async function loadPost(idOrSlug: string) {
  const supabase = supabaseServer();
  const key = safeOrValue(idOrSlug);

  const primary = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, meta_description, body, cover_url, created_at, updated_at, reading_time_minutes, categories, tags")
    .or(`slug.eq.${key},id.eq.${key}`)
    .limit(1)
    .maybeSingle();

  if (!primary.error) return primary.data as BlogPost | null;

  // Fallback for older schemas.
  const fallback = await supabase
    .from("blog_posts")
    .select("id, title, excerpt, body, cover_url, created_at")
    .eq("id", key)
    .limit(1)
    .maybeSingle();
  return (fallback.data as any) ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const item = await loadPost(params.id);
  const title = item?.title ?? "Blog";
  const description = clampMetaDescription(String((item as any)?.meta_description ?? item?.excerpt ?? ""));
  const image = item?.cover_url ?? "/logo.png";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonical = item ? `/blog/${item.slug ?? item.id}` : "/blog";

  return {
    title,
    description,
    alternates: { canonical },
    metadataBase: new URL(baseUrl),
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: image }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function BlogPostPage({ params }: { params: { id: string } }) {
  const data = await loadPost(String(params?.id ?? ""));

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
              <p className="muted">Este articulo no existe o fue eliminado.</p>
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

  const canonicalPath = `/blog/${data.slug ?? data.id}`;
  const meta = clampMetaDescription(String((data as any).meta_description ?? data.excerpt ?? ""));
  const readMin =
    typeof (data as any).reading_time_minutes === "number"
      ? Number((data as any).reading_time_minutes)
      : estimateReadingTimeMinutes(`${data.title}\n\n${data.body ?? ""}`);

  const { blocks, toc } = parseBlogBlocks(String(data.body ?? ""));
  const paragraphBlocks = blocks.filter((b) => b.type === "p") as any[];
  const hook = paragraphBlocks.slice(0, 3).map((b) => String(b.text));
  const trio = paragraphBlocks.slice(3, 6).map((b) => String(b.text));

  const what = trio[0] ?? "Que esta pasando: contexto directo, sin adornos.";
  const why = trio[1] ?? "Por que importa: impacto real, no teorias.";
  const who = trio[2] ?? "A quien afecta: a quien lo vive, lo paga o lo sufre.";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: data.title,
    description: meta,
    image: data.cover_url ? [data.cover_url] : undefined,
    datePublished: data.created_at ?? undefined,
    dateModified: (data as any).updated_at ?? data.created_at ?? undefined,
    author: { "@type": "Organization", name: "Sin Pelos en el Micrófono" },
    publisher: { "@type": "Organization", name: "Sin Pelos en el Micrófono" },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonicalPath }
  };

  // Related posts (cheap): latest 3 excluding current.
  const supabase = supabaseServer();
  const { data: relatedRaw } = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, meta_description, cover_url, created_at, reading_time_minutes, categories")
    .neq("id", data.id)
    .order("created_at", { ascending: false })
    .limit(3);
  const related = ((relatedRaw ?? []) as any[]).map((p) => ({
    ...p,
    meta_description: clampMetaDescription(String(p.meta_description ?? p.excerpt ?? "")),
    reading_time_minutes:
      typeof p.reading_time_minutes === "number" ? Number(p.reading_time_minutes) : estimateReadingTimeMinutes(`${p.title}\n\n${p.excerpt ?? ""}`)
  }));

  const renderBlock = (b: any, idx: number) => {
    if (b.type === "h2") return <h2 key={b.id} id={b.id} className="post-h2">{b.text}</h2>;
    if (b.type === "h3") return <h3 key={b.id} id={b.id} className="post-h3">{b.text}</h3>;
    if (b.type === "quote") return <blockquote key={`q-${idx}`} className="post-quote">{b.text}</blockquote>;
    if (b.type === "ul") return <ul key={`ul-${idx}`}>{(b.items ?? []).map((it: string, i: number) => <li key={i}>{it}</li>)}</ul>;
    if (b.type === "ol") return <ol key={`ol-${idx}`}>{(b.items ?? []).map((it: string, i: number) => <li key={i}>{it}</li>)}</ol>;
    return <p key={`p-${idx}`}>{b.text}</p>;
  };

  // Insert mid-content promo after a few blocks in the main reading flow.
  const insertAfter = Math.min(6, Math.max(2, blocks.filter((b) => b.type === "p").length >= 3 ? 4 : 2));

  return (
    <main className="blog-post-page">
      <Navbar />
      <ReadingProgressBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="section">
        <div className="container blog-container">
          <div className="blog-post-shell">
            <TableOfContents items={toc} />

            <article className="blog-post" id="reading-root">
              {data.cover_url ? (
                <div className="post-cover">
                  <img src={data.cover_url} alt={data.title} />
                </div>
              ) : null}

              <div className="post-badges">
                {(data.categories ?? []).slice(0, 3).map((c: string) => (
                  <span key={c} className="pill">
                    {c}
                  </span>
                ))}
                <span className="pill">Analisis</span>
              </div>

              <h1 className="post-h1">{data.title}</h1>
              {meta ? <p className="post-meta-desc">{meta}</p> : null}

              <div className="post-meta-row">
                <div className="post-meta">
                  <span>Sin Pelos</span>
                  <span>·</span>
                  <span>{formatDate(data.created_at)}</span>
                  <span>·</span>
                  <span>{readMin} min</span>
                </div>
                <ShareButtons path={canonicalPath} text={data.title} />
              </div>

              {hook.length ? (
                <Callout variant="hook">
                  {hook.map((p, i) => (
                    <p key={i} style={{ margin: i === 0 ? 0 : "10px 0 0" }}>
                      {p}
                    </p>
                  ))}
                </Callout>
              ) : null}

              <ProblemTrio what={what} why={why} who={who} />

              <div className="post-reading">
                {blocks.map((b, idx) => (
                  <div key={`${b.type}-${idx}`}>
                    {renderBlock(b, idx)}
                    {idx === insertAfter ? <MidContentAdSlot /> : null}
                  </div>
                ))}
              </div>

              <div className="post-cta card">
                <div className="sidebar-title">Conclusion</div>
                <p className="muted" style={{ marginTop: 8 }}>
                  Si esto te hizo pensar, comparte. Si te pico, vuelve manana. Aqui no se escribe para caer bien.
                </p>
                <div className="featured-actions">
                  <Link className="button" href="/blog">
                    Leer relacionado
                  </Link>
                  <a className="button secondary" href="#top">
                    Subir
                  </a>
                </div>
              </div>

              <div className="post-footer-actions">
                <Link className="button secondary" href="/blog">
                  Volver al blog
                </Link>
              </div>
            </article>
          </div>

          {related.length ? (
            <section className="section" style={{ paddingTop: 0 }}>
              <div className="home-section-head">
                <h2 className="section-title">Articulos relacionados</h2>
              </div>
              <div className="blog-grid">
                {related.map((p: any) => (
                  <article key={p.id} className="card post-card">
                    <Link className="post-card-media" href={`/blog/${p.slug ?? p.id}`}>
                      {p.cover_url ? <img src={p.cover_url} alt={p.title} loading="lazy" /> : <div className="post-card-fallback" />}
                    </Link>
                    <div className="post-card-body">
                      <h3 className="clamp-2" style={{ margin: 0 }}>
                        <Link href={`/blog/${p.slug ?? p.id}`}>{p.title}</Link>
                      </h3>
                      <p className="muted clamp-2" style={{ margin: "8px 0 0" }}>
                        {p.meta_description ?? ""}
                      </p>
                      <div className="post-meta">
                        <span>{formatDate(p.created_at)}</span>
                        <span>·</span>
                        <span>{p.reading_time_minutes} min</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}
