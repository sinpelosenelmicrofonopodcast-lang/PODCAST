import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { ReadingProgressBar } from "@/components/blog/ReadingProgressBar";
import { TableOfContents } from "@/components/blog/TableOfContents";
import { NewsletterForm } from "@/components/newsletter/NewsletterForm";
import { YouTubeInlinePlayer } from "@/components/YouTubeInlinePlayer";
import { supabaseServer } from "@/lib/supabaseServer";
import { clampMetaDescription, estimateReadingTimeMinutes } from "@/lib/blogSeo";
import { parseBlogBlocks } from "@/lib/blogContent";
import { getYouTubeVideoId } from "@/lib/youtube";

export const revalidate = 300;

type BlogPost = {
  id: string;
  slug?: string | null;
  title: string;
  excerpt: string | null;
  meta_description?: string | null;
  body: string | null;
  cover_url: string | null;
  episode_url?: string | null;
  episode_title?: string | null;
  created_at: string | null;
  updated_at?: string | null;
  reading_time_minutes?: number | null;
  categories?: string[] | null;
  tags?: string[] | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function postHref(post: { id: string; slug?: string | null }) {
  const slug = String(post.slug ?? "").trim();
  return `/blog/${slug || post.id}` as any;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", { year: "numeric", month: "short", day: "2-digit" });
}

function normalizeKey(v: string) {
  return decodeURIComponent(String(v ?? "").trim()).replace(/\/+$/, "");
}

function renderRichText(input: string): ReactNode[] {
  const text = String(input ?? "");
  if (!text) return [];

  const nodes: ReactNode[] = [];
  const tokenRegex = /(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(https?:\/\/[^\s<]+)/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const pushText = (value: string) => {
    if (!value) return;
    nodes.push(<span key={`t-${key++}`}>{value}</span>);
  };

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) pushText(text.slice(lastIndex, match.index));

    if (match[2] && match[3]) {
      nodes.push(
        <a key={`a-${key++}`} className="mag-link" href={match[3]} target="_blank" rel="noreferrer nofollow">
          {match[2]}
        </a>
      );
      lastIndex = tokenRegex.lastIndex;
      continue;
    }

    let url = match[4] ?? "";
    let trailing = "";
    while (/[),.;!?]$/.test(url)) {
      trailing = `${url.slice(-1)}${trailing}`;
      url = url.slice(0, -1);
    }

    if (url) {
      nodes.push(
        <a key={`a-${key++}`} className="mag-link" href={url} target="_blank" rel="noreferrer nofollow">
          {url}
        </a>
      );
    }
    if (trailing) pushText(trailing);
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) pushText(text.slice(lastIndex));
  return nodes;
}

async function loadPost(idOrSlug: string) {
  const supabase = supabaseServer();
  const key = normalizeKey(idOrSlug);
  if (!key) return null;

  const byIdFirst = UUID_RE.test(key);
  const candidates: Array<"id" | "slug"> = byIdFirst ? ["id", "slug"] : ["slug", "id"];
  const selectVariants = [
    "id, slug, title, excerpt, meta_description, body, cover_url, episode_url, episode_title, created_at, updated_at, reading_time_minutes, categories, tags",
    "id, slug, title, excerpt, meta_description, body, cover_url, created_at, updated_at, reading_time_minutes, categories, tags",
    "id, slug, title, excerpt, body, cover_url, created_at, updated_at",
    "id, title, excerpt, body, cover_url, created_at"
  ];

  for (const column of candidates) {
    if (column === "id" && !UUID_RE.test(key)) continue;

    for (const selectCols of selectVariants) {
      const query = supabase.from("blog_posts").select(selectCols).order("created_at", { ascending: false }).limit(1);
      const filtered = column === "slug" ? query.ilike("slug", key) : query.eq("id", key);
      const result = await filtered;
      const rows = (result.data as unknown as BlogPost[] | null) ?? [];
      if (!result.error && rows.length > 0) return rows[0];

      if (
        result.error &&
        !/(slug|meta_description|reading_time_minutes|categories|tags|updated_at|episode_url|episode_title)/i.test(result.error.message)
      ) {
        break;
      }
    }
  }

  // Fallback for very old schemas (id only).
  if (UUID_RE.test(key)) {
    const fallback = await supabase
      .from("blog_posts")
      .select("id, title, excerpt, body, cover_url, created_at")
      .eq("id", key)
      .limit(1)
      .maybeSingle();
    return (fallback.data as any) ?? null;
  }
  return null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const item = await loadPost(params.id);
  const title = item?.title ?? "Blog";
  const description = clampMetaDescription(String((item as any)?.meta_description ?? item?.excerpt ?? ""));
  const image = item?.cover_url ?? "/logo.png";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const canonical = item ? postHref(item) : "/blog";

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

  const canonicalPath = postHref(data);
  const meta = clampMetaDescription(String((data as any).meta_description ?? data.excerpt ?? ""));
  const readMin =
    typeof (data as any).reading_time_minutes === "number"
      ? Number((data as any).reading_time_minutes)
      : estimateReadingTimeMinutes(`${data.title}\n\n${data.body ?? ""}`);

  const { blocks, toc } = parseBlogBlocks(String(data.body ?? ""));
  const readingBlocks = blocks;
  const hasToc = toc.length > 0;

  const episodeUrl = String((data as any).episode_url ?? "").trim() || null;
  const episodeTitle = String((data as any).episode_title ?? "").trim() || null;
  const episodeYtId = episodeUrl ? getYouTubeVideoId(episodeUrl) : null;

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
  const relatedPrimary = await supabase
    .from("blog_posts")
    .select("id, slug, title, excerpt, meta_description, cover_url, created_at, reading_time_minutes, categories")
    .neq("id", data.id)
    .order("created_at", { ascending: false })
    .limit(3);
  const relatedFallback =
    relatedPrimary.error && /(slug|meta_description|reading_time_minutes|categories)/i.test(relatedPrimary.error.message)
      ? await supabase
          .from("blog_posts")
          .select("id, title, excerpt, cover_url, created_at")
          .neq("id", data.id)
          .order("created_at", { ascending: false })
          .limit(3)
      : null;
  const relatedRaw = (relatedFallback?.data ?? relatedPrimary.data) as any[] | null;
  const related = ((relatedRaw ?? []) as any[]).map((p) => ({
    ...p,
    meta_description: clampMetaDescription(String(p.meta_description ?? p.excerpt ?? "")),
    reading_time_minutes:
      typeof p.reading_time_minutes === "number" ? Number(p.reading_time_minutes) : estimateReadingTimeMinutes(`${p.title}\n\n${p.excerpt ?? ""}`)
  }));

  const renderBlock = (b: any, idx: number) => {
    if (b.type === "h2")
      return (
        <h2 key={b.id} id={b.id} className="mag-h2 mag-h2-block">
          {renderRichText(b.text)}
        </h2>
      );
    if (b.type === "h3")
      return (
        <h3 key={b.id} id={b.id} className="mag-h3">
          {renderRichText(b.text)}
        </h3>
      );
    if (b.type === "quote")
      return (
        <blockquote key={`q-${idx}`} className="mag-quote">
          {renderRichText(b.text)}
        </blockquote>
      );
    if (b.type === "ul")
      return (
        <ul key={`ul-${idx}`}>
          {(b.items ?? []).map((it: string, i: number) => (
            <li key={i}>{renderRichText(it)}</li>
          ))}
        </ul>
      );
    if (b.type === "ol")
      return (
        <ol key={`ol-${idx}`}>
          {(b.items ?? []).map((it: string, i: number) => (
            <li key={i}>{renderRichText(it)}</li>
          ))}
        </ol>
      );
    return <p key={`p-${idx}`}>{renderRichText(b.text)}</p>;
  };

  // Insert mid-content promo after 2nd or 3rd paragraph in the reading flow (not counting Hook/Trio).
  const readingParagraphIdxs: number[] = [];
  readingBlocks.forEach((b, idx) => {
    if (b.type === "p") readingParagraphIdxs.push(idx);
  });
  const insertAfter =
    readingParagraphIdxs.length >= 3
      ? readingParagraphIdxs[2] // after 3rd paragraph
      : readingParagraphIdxs.length >= 2
        ? readingParagraphIdxs[1] // after 2nd paragraph
        : readingParagraphIdxs.length >= 1
          ? readingParagraphIdxs[0] // after 1st paragraph (fallback)
          : -1;

  return (
    <main className="blog-mag blog-mag-post">
      <Navbar />
      <ReadingProgressBar />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section
        id="top"
        className="mag-post-hero"
        style={
          data.cover_url
            ? ({
                ["--hero-bg" as any]: `url(${data.cover_url})`
              } as any)
            : undefined
        }
      >
        <div className="container blog-container">
          <div className="mag-post-hero-inner">
            <div className="mag-post-kickers">
              {(data.categories ?? []).slice(0, 1).map((c: string) => (
                <span key={c} className={`mag-cat ${c === "Zona Cruda" ? "mag-cat-cruda" : ""}`}>
                  {c}
                </span>
              ))}
              <span className="mag-cat">Editorial</span>
            </div>
            <h1 className="mag-post-h1">{data.title}</h1>
            {meta ? <p className="mag-post-sub">{meta}</p> : null}
            <div className="mag-post-meta">
              <span>{formatDate(data.created_at)}</span>
              <span className="dot">·</span>
              <span>{readMin} min</span>
            </div>
            <div className="mag-post-share">
              <ShareButtons path={canonicalPath} text={data.title} />
            </div>
            {data.cover_url ? (
              <div className="mag-post-cover">
                <img src={data.cover_url} alt={data.title} loading="eager" />
              </div>
            ) : null}

            {episodeUrl ? (
              <div className="mag-episode">
                <div className="mag-episode-head">
                  <div>
                    <div className="mag-episode-kicker">Episodio relacionado</div>
                    <div className="mag-episode-title clamp-2">{episodeTitle ?? "Ver episodio"}</div>
                  </div>
                  <div className="mag-episode-actions">
                    <a className="mag-btn mag-btn-primary" href={episodeUrl} target="_blank" rel="noreferrer">
                      Abrir
                    </a>
                  </div>
                </div>
                {episodeYtId ? (
                  <YouTubeInlinePlayer
                    videoId={episodeYtId}
                    title={episodeTitle ?? data.title}
                    className="yt-inline yt-inline-tight"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mag-post-body">
        <div className="container blog-container">
          <div className={`mag-post-shell ${hasToc ? "" : "no-toc"}`}>
            <article className="mag-post-article" id="reading-root">
              <div className="mag-reading">
                {readingBlocks.map((b, idx) => (
                  <div key={`${b.type}-${idx}`} className={`mag-reading-block mag-reading-block-${b.type}`}>
                    {renderBlock(b, idx)}
                    {insertAfter >= 0 && idx === insertAfter ? <MidContentAdSlot /> : null}
                  </div>
                ))}
              </div>

              <section className="mag-cta">
                <div className="mag-cta-inner">
                  <div className="mag-cta-title">Conclusión</div>
                  <p className="mag-cta-text">
                    Si esto te hizo pensar, perfecto. Si te picó, mejor. Aquí no se escribe para caer bien.
                  </p>
                  <div className="mag-cta-actions">
                    <Link className="mag-btn mag-btn-primary" href="/blog">
                      Leer más
                    </Link>
                    <a className="mag-btn mag-btn-ghost" href="#top">
                      Subir
                    </a>
                  </div>
                </div>
              </section>

              <NewsletterForm variant="cta" title="Recibe lo nuevo primero" subtitle="Análisis, noticias y cultura. Directo a tu inbox." />

              <div className="post-footer-actions">
                <Link className="mag-btn mag-btn-ghost" href="/blog">
                  Volver al blog
                </Link>
              </div>
            </article>
            <TableOfContents items={toc} />
          </div>

          {related.length ? (
            <section className="mag-related">
              <div className="mag-related-head">
                <h2 className="mag-h2" style={{ margin: 0 }}>
                  Relacionados
                </h2>
              </div>
              <div className="mag-grid" style={{ marginTop: 18 }}>
                {related.map((p: any) => (
                  <article key={p.id} className="mag-card">
                    <Link className="mag-card-media" href={postHref(p)} aria-label={p.title}>
                      {p.cover_url ? <img src={p.cover_url} alt={p.title} loading="lazy" /> : <div className="mag-card-fallback" />}
                    </Link>
                    <div className="mag-card-body">
                      <div className="mag-card-top">
                        {(p.categories ?? []).slice(0, 1).map((c: string) => (
                          <span key={c} className={`mag-cat ${c === "Zona Cruda" ? "mag-cat-cruda" : ""}`}>
                            {c}
                          </span>
                        ))}
                        <div className="mag-meta">
                          <span>{formatDate(p.created_at)}</span>
                          <span className="dot">·</span>
                          <span>{p.reading_time_minutes} min</span>
                        </div>
                      </div>
                      <h3 className="mag-h2 clamp-2" style={{ margin: 0 }}>
                        <Link href={postHref(p)}>{p.title}</Link>
                      </h3>
                      <p className="mag-excerpt clamp-2" style={{ margin: "10px 0 0" }}>
                        {p.meta_description ?? ""}
                      </p>
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
