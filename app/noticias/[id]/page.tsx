import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { CommentComposer } from "@/components/CommentComposer";
import { ShareButtons } from "@/components/ShareButtons";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { getServerLang } from "@/lib/i18nServer";
import type { AppLang } from "@/lib/language";

export const revalidate = 180;

type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  analysis: string | null;
  source_url: string | null;
  cover_url: string | null;
  categories: string[] | null;
  published_at: string | null;
};

type RelatedNewsItem = {
  id: string;
  title: string;
  cover_url: string | null;
  categories: string[] | null;
  published_at: string | null;
};

type CommentRow = {
  id: string;
  body: string;
  created_at: string | null;
  users: { nickname: string | null; avatar_url: string | null } | Array<{ nickname: string | null; avatar_url: string | null }> | null;
};

type ContentBlock =
  | { type: "paragraph"; text: string }
  | { type: "subheading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "quote"; text: string };

const t: Record<
  AppLang,
  {
    back: string;
    notFound: string;
    analysis: string;
    confirmed: string;
    breaking: string;
    published: string;
    readTime: string;
    keyPoints: string;
    source: string;
    sourceCta: string;
    commentsTitle: string;
    commentsHint: string;
    firstComment: string;
    moreIn: string;
    trending: string;
    previous: string;
    next: string;
  }
> = {
  es: {
    back: "Volver a noticias",
    notFound: "Noticia no encontrada.",
    analysis: "Análisis",
    confirmed: "Confirmado",
    breaking: "Última hora",
    published: "Publicado",
    readTime: "Tiempo de lectura",
    keyPoints: "Puntos clave",
    source: "Fuente",
    sourceCta: "Ver fuente original",
    commentsTitle: "Comunidad",
    commentsHint: "Debate ideas sin ataques personales.",
    firstComment: "Sé el primero en comentar.",
    moreIn: "Más en",
    trending: "Tendencias",
    previous: "Noticia anterior",
    next: "Siguiente noticia"
  },
  en: {
    back: "Back to news",
    notFound: "Story not found.",
    analysis: "Analysis",
    confirmed: "Confirmed",
    breaking: "Breaking",
    published: "Published",
    readTime: "Read time",
    keyPoints: "Key points",
    source: "Source",
    sourceCta: "View original source",
    commentsTitle: "Community",
    commentsHint: "Debate ideas without personal attacks.",
    firstComment: "Be the first to comment.",
    moreIn: "More in",
    trending: "Trending",
    previous: "Previous story",
    next: "Next story"
  }
};

const pickUser = (users: CommentRow["users"]) => (Array.isArray(users) ? users[0] : users);

function isRecent(dateValue?: string | null) {
  if (!dateValue) return false;
  const ms = new Date(dateValue).getTime();
  if (!Number.isFinite(ms)) return false;
  return Date.now() - ms <= 1000 * 60 * 60 * 24;
}

function formatDate(value?: string | null, lang: AppLang = "es") {
  if (!value) return "";
  return new Date(value).toLocaleDateString(lang === "es" ? "es-PR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function estimateReadMinutes(text: string) {
  const words = String(text ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function parseContentBlocks(raw: string): ContentBlock[] {
  const source = String(raw ?? "").trim();
  if (!source) return [];

  const chunks = source
    .split(/\n{2,}/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const blocks: ContentBlock[] = [];

  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    const first = lines[0];
    if (/^#{1,3}\s+/.test(first)) {
      blocks.push({ type: "subheading", text: first.replace(/^#{1,3}\s+/, "").trim() });
      continue;
    }

    const listItems = lines
      .filter((line) => /^[-*•]\s+/.test(line))
      .map((line) => line.replace(/^[-*•]\s+/, "").trim())
      .filter(Boolean);
    if (listItems.length >= 2 && listItems.length === lines.length) {
      blocks.push({ type: "list", items: listItems });
      continue;
    }

    if (/^>\s?/.test(first)) {
      blocks.push({ type: "quote", text: lines.map((line) => line.replace(/^>\s?/, "")).join(" ").trim() });
      continue;
    }

    if (lines.length === 1 && /:$/.test(first) && first.length <= 90) {
      blocks.push({ type: "subheading", text: first.replace(/:$/, "").trim() });
      continue;
    }

    blocks.push({ type: "paragraph", text: lines.join(" ") });
  }

  return blocks;
}

function extractKeyPoints(summary: string, blocks: ContentBlock[]) {
  const listBlock = blocks.find((block) => block.type === "list") as Extract<ContentBlock, { type: "list" }> | undefined;
  if (listBlock?.items?.length) return listBlock.items.slice(0, 4);

  const clean = String(summary ?? "").trim();
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 24)
    .slice(0, 4);
}

function buildEditorialTags(item: NewsItem, lang: AppLang) {
  const labels = t[lang];
  const tags: string[] = [labels.confirmed];
  if (isRecent(item.published_at)) tags.push(labels.breaking);
  if (String(item.analysis ?? "").trim()) tags.push(labels.analysis);
  return tags;
}

async function loadItem(supabase: ReturnType<typeof supabaseServer>, id: string) {
  let query = supabase
    .from("news_items")
    .select("id, title, summary, analysis, source_url, cover_url, categories, published_at")
    .eq("publication_state", "published")
    .eq("id", id)
    .maybeSingle();

  let { data, error } = await query;
  if (error && /publication_state/i.test(error.message)) {
    const fallback = await supabase
      .from("news_items")
      .select("id, title, summary, analysis, source_url, cover_url, categories, published_at")
      .eq("id", id)
      .maybeSingle();
    data = fallback.data;
  }
  return (data as NewsItem | null) ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = supabaseServer();
  const item = await loadItem(supabase, params.id);
  const title = item?.title ?? "Noticia";
  const description = item?.summary ?? "Noticias Sin Pelos";
  const image = item?.cover_url ?? "/logo.png";
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  return {
    title,
    description,
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

export default async function NoticiaDetailPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const lang = getServerLang();
  const copy = t[lang];

  const item = await loadItem(supabase, params.id);

  const { data: commentsRaw } = await supabase
    .from("comments")
    .select("id, body, created_at, users(nickname, avatar_url)")
    .eq("content_type", "news")
    .eq("content_id", params.id)
    .order("created_at", { ascending: true });

  const comments = (commentsRaw ?? []) as CommentRow[];

  let related: RelatedNewsItem[] = [];
  let trending: Array<RelatedNewsItem & { comments_count: number }> = [];
  let prevItem: RelatedNewsItem | null = null;
  let nextItem: RelatedNewsItem | null = null;

  if (item) {
    const primaryCategory = String(item.categories?.[0] ?? "").trim();

    let relatedQuery = supabase
      .from("news_items")
      .select("id, title, cover_url, categories, published_at")
      .eq("publication_state", "published")
      .neq("id", item.id)
      .order("published_at", { ascending: false })
      .limit(12);
    if (primaryCategory) relatedQuery = relatedQuery.contains("categories", [primaryCategory]);
    let { data: relatedRows, error: relatedErr } = await relatedQuery;
    if (relatedErr && /publication_state/i.test(relatedErr.message)) {
      let fallback = supabase
        .from("news_items")
        .select("id, title, cover_url, categories, published_at")
        .neq("id", item.id)
        .order("published_at", { ascending: false })
        .limit(12);
      if (primaryCategory) fallback = fallback.contains("categories", [primaryCategory]);
      const retry = await fallback;
      relatedRows = retry.data;
      relatedErr = retry.error;
    }
    if (relatedErr) relatedRows = [];
    related = ((relatedRows ?? []) as RelatedNewsItem[]).slice(0, 4);

    let trendingQuery = supabase
      .from("news_items")
      .select("id, title, cover_url, categories, published_at")
      .eq("publication_state", "published")
      .neq("id", item.id)
      .order("published_at", { ascending: false })
      .limit(10);
    let { data: trendingRows, error: trendingErr } = await trendingQuery;
    if (trendingErr && /publication_state/i.test(trendingErr.message)) {
      const fallback = await supabase
        .from("news_items")
        .select("id, title, cover_url, categories, published_at")
        .neq("id", item.id)
        .order("published_at", { ascending: false })
        .limit(10);
      trendingRows = fallback.data;
      trendingErr = fallback.error;
    }
    if (trendingErr) trendingRows = [];

    const trendRows = (trendingRows ?? []) as RelatedNewsItem[];
    if (trendRows.length > 0) {
      const ids = trendRows.map((row) => row.id);
      const { data: trendComments } = await supabase
        .from("comments")
        .select("content_id")
        .eq("content_type", "news")
        .in("content_id", ids);

      const counts = new Map<string, number>();
      (trendComments ?? []).forEach((row: any) => {
        const id = String(row.content_id ?? "");
        counts.set(id, (counts.get(id) ?? 0) + 1);
      });

      trending = trendRows
        .map((row) => ({ ...row, comments_count: counts.get(row.id) ?? 0 }))
        .sort((a, b) => {
          const byComments = b.comments_count - a.comments_count;
          if (byComments !== 0) return byComments;
          return new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime();
        })
        .slice(0, 5);
    }

    if (item.published_at) {
      let prevQuery = supabase
        .from("news_items")
        .select("id, title, cover_url, categories, published_at")
        .eq("publication_state", "published")
        .lt("published_at", item.published_at)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let prevRes = await prevQuery;
      if (prevRes.error && /publication_state/i.test(prevRes.error.message)) {
        prevRes = await supabase
          .from("news_items")
          .select("id, title, cover_url, categories, published_at")
          .lt("published_at", item.published_at)
          .order("published_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      }
      prevItem = (prevRes.data as RelatedNewsItem | null) ?? null;

      let nextQuery = supabase
        .from("news_items")
        .select("id, title, cover_url, categories, published_at")
        .eq("publication_state", "published")
        .gt("published_at", item.published_at)
        .order("published_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      let nextRes = await nextQuery;
      if (nextRes.error && /publication_state/i.test(nextRes.error.message)) {
        nextRes = await supabase
          .from("news_items")
          .select("id, title, cover_url, categories, published_at")
          .gt("published_at", item.published_at)
          .order("published_at", { ascending: true })
          .limit(1)
          .maybeSingle();
      }
      nextItem = (nextRes.data as RelatedNewsItem | null) ?? null;
    }
  }

  const bodyBlocks = parseContentBlocks(String(item?.analysis ?? ""));
  const keyPoints = extractKeyPoints(String(item?.summary ?? ""), bodyBlocks);
  const paragraphIndexes = bodyBlocks.reduce<number[]>((acc, block, idx) => {
    if (block.type === "paragraph") acc.push(idx);
    return acc;
  }, []);
  const adAfterIndex =
    paragraphIndexes.length >= 3
      ? paragraphIndexes[2]
      : paragraphIndexes.length >= 2
        ? paragraphIndexes[1]
        : paragraphIndexes.length === 1
          ? paragraphIndexes[0]
          : -1;
  const readTime = estimateReadMinutes(`${item?.title ?? ""}\n${item?.summary ?? ""}\n${item?.analysis ?? ""}`);
  const editorialTags = item ? buildEditorialTags(item, lang) : [];

  return (
    <main>
      <Navbar />
      <section className="section news-article-page">
        <div className="container news-article-container">
          <Link className="button secondary news-back-link" href="/noticias">
            {copy.back}
          </Link>

          {item ? (
            <>
              <article className="card news-article-hero">
                <div className="news-article-cover">
                  {item.cover_url ? (
                    <Image
                      src={item.cover_url}
                      alt={item.title}
                      fill
                      unoptimized
                      priority
                      sizes="(max-width: 920px) 100vw, 1100px"
                      style={{ objectFit: "contain", objectPosition: "center center", background: "#09090d" }}
                    />
                  ) : (
                    <div className="news-article-cover-fallback" />
                  )}
                  <div className="news-article-overlay" />
                </div>
                <div className="news-article-hero-content-block">
                  <div className="news-article-badges">
                    {editorialTags.map((tag) => (
                      <span key={tag} className="news-badge">
                        {tag}
                      </span>
                    ))}
                    {(item.categories ?? []).slice(0, 3).map((cat) => (
                      <span key={cat} className="news-badge">
                        {cat}
                      </span>
                    ))}
                  </div>
                  <h1 className="news-article-title">{item.title}</h1>
                  {item.summary ? <p className="news-article-excerpt">{item.summary}</p> : null}
                </div>
                <div className="news-article-meta-row">
                  <div className="news-article-meta">
                    <span>
                      {copy.published}: {formatDate(item.published_at, lang)}
                    </span>
                    <span className="dot">·</span>
                    <span>
                      {copy.readTime}: {readTime} min
                    </span>
                  </div>
                  <div className="news-article-meta-actions">
                    <ShareButtons path={`/noticias/${item.id}`} text={item.title} />
                  </div>
                </div>
              </article>

              <div className="news-article-layout">
                <article className="card news-article-main">
                  {keyPoints.length > 0 ? (
                    <section className="news-keypoints">
                      <h2>{copy.keyPoints}</h2>
                      <ul>
                        {keyPoints.map((point, idx) => (
                          <li key={`${idx}-${point.slice(0, 20)}`}>{point}</li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <div className="news-article-body">
                    {bodyBlocks.length > 0 ? (
                      bodyBlocks.map((block, idx) => (
                        <div key={`${block.type}-${idx}`}>
                          {block.type === "subheading" ? <h2>{block.text}</h2> : null}
                          {block.type === "paragraph" ? <p>{block.text}</p> : null}
                          {block.type === "quote" ? <blockquote>{block.text}</blockquote> : null}
                          {block.type === "list" ? (
                            <ul>
                              {block.items.map((itemText, itemIdx) => (
                                <li key={`${itemIdx}-${itemText.slice(0, 16)}`}>{itemText}</li>
                              ))}
                            </ul>
                          ) : null}
                          {idx === adAfterIndex ? <MidContentAdSlot /> : null}
                        </div>
                      ))
                    ) : (
                      <p className="muted">{item.summary}</p>
                    )}
                  </div>

                  {item.source_url ? (
                    <section className="news-source-cta-wrap">
                      <div className="news-source-label">{copy.source}</div>
                      <a className="news-source-cta" href={item.source_url} target="_blank" rel="noreferrer" aria-label={copy.sourceCta}>
                        <span>{copy.sourceCta}</span>
                        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">
                          <path
                            d="M14 4h6v6h-2V7.41l-7.29 7.3-1.42-1.42 7.3-7.29H14V4ZM5 6h6v2H7v10h10v-4h2v6H5V6Z"
                            fill="currentColor"
                          />
                        </svg>
                      </a>
                    </section>
                  ) : null}
                </article>

                <aside className="news-article-sidebar">
                  {related.length > 0 ? (
                    <section className="card news-article-side-card">
                      <h3>
                        {copy.moreIn} {(item.categories ?? [])[0] ?? "Sin Pelos"}
                      </h3>
                      <div className="news-side-list">
                        {related.map((story) => (
                          <Link key={story.id} href={`/noticias/${story.id}`} className="news-side-item">
                            <div className="news-side-thumb">
                              {story.cover_url ? (
                                <Image
                                  src={story.cover_url}
                                  alt={story.title}
                                  fill
                                  unoptimized
                                  sizes="120px"
                                  style={{ objectFit: "contain", background: "#09090d" }}
                                />
                              ) : (
                                <div className="news-side-thumb-fallback" />
                              )}
                            </div>
                            <div>
                              <p className="news-side-title">{story.title}</p>
                              <p className="muted news-side-date">{formatDate(story.published_at, lang)}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {trending.length > 0 ? (
                    <section className="card news-article-side-card">
                      <h3>{copy.trending}</h3>
                      <div className="news-side-list">
                        {trending.map((story) => (
                          <Link key={story.id} href={`/noticias/${story.id}`} className="news-side-item">
                            <div className="news-side-thumb">
                              {story.cover_url ? (
                                <Image
                                  src={story.cover_url}
                                  alt={story.title}
                                  fill
                                  unoptimized
                                  sizes="120px"
                                  style={{ objectFit: "contain", background: "#09090d" }}
                                />
                              ) : (
                                <div className="news-side-thumb-fallback" />
                              )}
                            </div>
                            <div>
                              <p className="news-side-title">{story.title}</p>
                              <p className="muted news-side-date">
                                {story.comments_count} {lang === "es" ? "comentarios" : "comments"}
                              </p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </aside>
              </div>

              <section className="card news-comments-card">
                <div className="news-comments-head">
                  <div>
                    <h3>{copy.commentsTitle}</h3>
                    <p className="muted">{copy.commentsHint}</p>
                  </div>
                  <span className="news-comments-count">{comments.length}</span>
                </div>

                {comments.length > 0 ? (
                  <div className="news-comments-list">
                    {comments.map((comment) => {
                      const user = pickUser(comment.users);
                      return (
                        <article key={comment.id} className="news-comment">
                          <div className="news-comment-avatar">
                            <Image
                              src={user?.avatar_url ?? "/logo.png"}
                              alt={user?.nickname ?? "avatar"}
                              fill
                              unoptimized
                              sizes="36px"
                              style={{ objectFit: "cover" }}
                            />
                          </div>
                          <div className="news-comment-body">
                            <div className="news-comment-top">
                              <strong>{user?.nickname ?? "Anónimo"}</strong>
                              <span className="muted">{formatDate(comment.created_at, lang)}</span>
                            </div>
                            <p>{comment.body}</p>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className="muted">{copy.firstComment}</p>
                )}

                <CommentComposer contentId={params.id} contentType="news" />
              </section>

              {prevItem || nextItem ? (
                <nav className="card news-next-prev" aria-label="Navegación de noticias">
                  {prevItem ? (
                    <Link href={`/noticias/${prevItem.id}`} className="news-nav-link">
                      <span className="muted">{copy.previous}</span>
                      <span className="news-nav-title">{prevItem.title}</span>
                    </Link>
                  ) : (
                    <div className="news-nav-link news-nav-empty" />
                  )}
                  {nextItem ? (
                    <Link href={`/noticias/${nextItem.id}`} className="news-nav-link news-nav-link-right">
                      <span className="muted">{copy.next}</span>
                      <span className="news-nav-title">{nextItem.title}</span>
                    </Link>
                  ) : (
                    <div className="news-nav-link news-nav-empty" />
                  )}
                </nav>
              ) : null}
            </>
          ) : (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="muted">{copy.notFound}</p>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
