import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { CommentComposer } from "@/components/CommentComposer";
import { ShareButtons } from "@/components/ShareButtons";
import { MidContentAdSlot } from "@/components/promotions/MidContentAdSlot";
import { getServerLang } from "@/lib/i18nServer";
import type { AppLang } from "@/lib/language";
import { isUuid, newsHref, normalizeNewsKey } from "@/lib/newsRoute";
import { buildSeoMetadata, newsSeoTemplate } from "@/lib/seo/meta";
import { buildNewsArticleJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { canonicalUrl } from "@/lib/seo/constants";
import { buildRenderableImageUrl, normalizeImageUrl } from "@/lib/imageUrl";
import { cleanNewsCategories } from "@/lib/newsCategories";

export const revalidate = 180;

type NewsItem = {
  id: string;
  slug?: string | null;
  title: string;
  summary: string | null;
  analysis: string | null;
  source_url: string | null;
  cover_url: string | null;
  video_url: string | null;
  categories: string[] | null;
  published_at: string | null;
  updated_at?: string | null;
};

type RelatedNewsItem = {
  id: string;
  slug?: string | null;
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

const COPY: Record<AppLang, {
  back: string;
  notFound: string;
  published: string;
  readTime: string;
  keyPoints: string;
  source: string;
  sourceCta: string;
  video: string;
  commentsTitle: string;
  commentsHint: string;
  firstComment: string;
  moreIn: string;
  trending: string;
  previous: string;
  next: string;
}> = {
  es: {
    back: "Volver a noticias",
    notFound: "Noticia no encontrada.",
    published: "Publicado",
    readTime: "Tiempo de lectura",
    keyPoints: "Puntos clave",
    source: "Fuente",
    sourceCta: "Ver fuente original",
    video: "Video relacionado",
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
    published: "Published",
    readTime: "Read time",
    keyPoints: "Key points",
    source: "Source",
    sourceCta: "View original source",
    video: "Related video",
    commentsTitle: "Community",
    commentsHint: "Debate ideas without personal attacks.",
    firstComment: "Be the first to comment.",
    moreIn: "More in",
    trending: "Trending",
    previous: "Previous story",
    next: "Next story"
  }
};

function normalizeItemCover<T extends { cover_url: string | null }>(item: T): T {
  return { ...item, cover_url: normalizeImageUrl(item.cover_url) };
}

function pickUser(users: CommentRow["users"]) {
  return Array.isArray(users) ? users[0] : users;
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
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function isOptimizableImage(value?: string | null) {
  const src = String(value ?? "").trim();
  if (!src || src.startsWith("/")) return true;
  try {
    const host = new URL(src).hostname.toLowerCase();
    return host === "bhuophwyhgnqhbstinqw.supabase.co" || host === "i.ytimg.com" || host === "img.youtube.com";
  } catch {
    return false;
  }
}

function NewsImage({ src, alt, sizes, priority = false }: { src: string; alt: string; sizes: string; priority?: boolean }) {
  const renderable = buildRenderableImageUrl(src, alt);
  if (isOptimizableImage(renderable)) {
    return (
      <Image
        src={renderable}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        style={{ objectFit: "contain", objectPosition: "center center", background: "#09090d" }}
      />
    );
  }
  return (
    <img
      src={renderable}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", background: "#09090d" }}
    />
  );
}

function getSupportedVideoEmbedUrl(raw?: string | null) {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const path = url.pathname;
    if (host === "drive.google.com" || host === "www.drive.google.com") {
      const fileId = path.match(/\/file\/d\/([^/]+)/i)?.[1] ?? path.match(/\/d\/([^/]+)/i)?.[1] ?? url.searchParams.get("id");
      return fileId ? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview` : null;
    }
    if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      let videoId: string | null = null;
      if (host === "youtu.be") videoId = path.split("/").filter(Boolean)[0] ?? null;
      else if (path.startsWith("/watch")) videoId = url.searchParams.get("v");
      else if (path.startsWith("/shorts/") || path.startsWith("/embed/")) videoId = path.split("/").filter(Boolean)[1] ?? null;
      return videoId ? `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1` : null;
    }
    if (host === "vimeo.com" || host === "www.vimeo.com" || host === "player.vimeo.com") {
      const videoId = path.match(/\/(?:video\/)?(\d+)/i)?.[1] ?? null;
      return videoId ? `https://player.vimeo.com/video/${encodeURIComponent(videoId)}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

function parseContentBlocks(raw: string): ContentBlock[] {
  const source = String(raw ?? "").trim();
  if (!source) return [];
  const chunks = source.split(/\n{2,}/g).map((chunk) => chunk.trim()).filter(Boolean);
  const blocks: ContentBlock[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    const first = lines[0];
    if (/^#{1,3}\s+/.test(first)) {
      blocks.push({ type: "subheading", text: first.replace(/^#{1,3}\s+/, "").trim() });
      continue;
    }
    const listItems = lines.filter((line) => /^[-*•]\s+/.test(line)).map((line) => line.replace(/^[-*•]\s+/, "").trim()).filter(Boolean);
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
  return String(summary ?? "").trim().split(/(?<=[.!?])\s+/).map((line) => line.trim()).filter((line) => line.length > 24).slice(0, 4);
}

async function loadItem(supabase: ReturnType<typeof supabaseServer>, id: string) {
  const key = normalizeNewsKey(id);
  if (!key) return null;
  const candidates: Array<"id" | "slug"> = isUuid(key) ? ["id", "slug"] : ["slug", "id"];
  const selectVariants = [
    "id, slug, title, summary, analysis, source_url, cover_url, video_url, categories, published_at, updated_at",
    "id, slug, title, summary, analysis, source_url, cover_url, video_url, categories, published_at",
    "id, slug, title, summary, analysis, source_url, cover_url, categories, published_at",
    "id, title, summary, analysis, source_url, cover_url, categories, published_at"
  ];

  for (const column of candidates) {
    if (column === "id" && !isUuid(key)) continue;
    for (const selectCols of selectVariants) {
      for (const withPublicationState of [true, false]) {
        let query = supabase.from("news_items").select(selectCols).order("published_at", { ascending: false }).limit(1);
        if (withPublicationState) query = query.eq("publication_state", "published");
        query = column === "slug" ? query.ilike("slug", key) : query.eq("id", key);
        const result = await query;
        const rows = (result.data as unknown as NewsItem[] | null) ?? [];
        if (!result.error && rows.length > 0) return normalizeItemCover(rows[0]);
        if (result.error && !/(slug|video_url|updated_at|publication_state)/i.test(result.error.message)) break;
      }
    }
  }
  return null;
}

async function loadRelated(supabase: ReturnType<typeof supabaseServer>, item: NewsItem) {
  const categories = cleanNewsCategories(item.categories);
  const primary = categories[0] ?? "";
  let query = supabase.from("news_items").select("id,slug,title,cover_url,categories,published_at").eq("publication_state", "published").neq("id", item.id).order("published_at", { ascending: false }).limit(12);
  if (primary) query = query.contains("categories", [primary]);
  let result = await query;
  if (result.error && /publication_state/i.test(result.error.message)) {
    let fallback = supabase.from("news_items").select("id,slug,title,cover_url,categories,published_at").neq("id", item.id).order("published_at", { ascending: false }).limit(12);
    if (primary) fallback = fallback.contains("categories", [primary]);
    result = await fallback;
  }
  return ((result.data ?? []) as RelatedNewsItem[]).map(normalizeItemCover).slice(0, 4);
}

async function loadTrending(supabase: ReturnType<typeof supabaseServer>, item: NewsItem) {
  let result = await supabase.from("news_items").select("id,slug,title,cover_url,categories,published_at").eq("publication_state", "published").neq("id", item.id).order("published_at", { ascending: false }).limit(10);
  if (result.error && /publication_state/i.test(result.error.message)) {
    result = await supabase.from("news_items").select("id,slug,title,cover_url,categories,published_at").neq("id", item.id).order("published_at", { ascending: false }).limit(10);
  }
  const rows = ((result.data ?? []) as RelatedNewsItem[]).map(normalizeItemCover);
  if (!rows.length) return [] as Array<RelatedNewsItem & { comments_count: number }>;
  const ids = rows.map((row) => row.id);
  const { data: comments } = await supabase.from("comments").select("content_id").eq("content_type", "news").in("content_id", ids);
  const counts = new Map<string, number>();
  (comments ?? []).forEach((row: any) => {
    const key = String(row.content_id ?? "");
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return rows.map((row) => ({ ...row, comments_count: counts.get(row.id) ?? 0 })).sort((a, b) => b.comments_count - a.comments_count || new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime()).slice(0, 5);
}

async function loadSibling(supabase: ReturnType<typeof supabaseServer>, item: NewsItem, direction: "previous" | "next") {
  if (!item.published_at) return null;
  const isPrevious = direction === "previous";
  let query = supabase.from("news_items").select("id,slug,title,cover_url,categories,published_at").eq("publication_state", "published");
  query = isPrevious ? query.lt("published_at", item.published_at) : query.gt("published_at", item.published_at);
  query = query.order("published_at", { ascending: !isPrevious }).limit(1);
  let result = await query.maybeSingle();
  if (result.error && /publication_state/i.test(result.error.message)) {
    let fallback = supabase.from("news_items").select("id,slug,title,cover_url,categories,published_at");
    fallback = isPrevious ? fallback.lt("published_at", item.published_at) : fallback.gt("published_at", item.published_at);
    result = await fallback.order("published_at", { ascending: !isPrevious }).limit(1).maybeSingle();
  }
  return result.data ? normalizeItemCover(result.data as RelatedNewsItem) : null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const item = await loadItem(supabaseServer(), params.id);
  const canonical = item ? newsHref(item) : `/noticias/${encodeURIComponent(params.id)}`;
  const ogVersion = encodeURIComponent(String(item?.updated_at ?? item?.published_at ?? "20260321"));
  const directCoverImage = item?.cover_url && /^https?:\/\//i.test(item.cover_url) ? item.cover_url : null;
  const socialImage = directCoverImage ?? canonicalUrl(`${canonical}/opengraph-image?v=${ogVersion}`);
  const seo = newsSeoTemplate(item?.title ?? "Noticia", item?.summary ?? "Noticias Sin Pelos");
  const metadata = buildSeoMetadata({ title: seo.title, description: seo.description, path: canonical, image: socialImage, type: "article", noindex: !item });
  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images: [{ url: socialImage, ...(directCoverImage ? {} : { width: 1200, height: 630 }), alt: item?.title ?? seo.title }] },
    twitter: { ...metadata.twitter, images: [socialImage] }
  };
}

export default async function NoticiaDetailPage({ params }: { params: { id: string } }) {
  const supabase = supabaseServer();
  const lang = getServerLang();
  const copy = COPY[lang];
  const item = await loadItem(supabase, params.id);
  const requestedKey = normalizeNewsKey(params.id);
  if (!item) notFound();

  if (item?.slug && requestedKey && item.slug !== requestedKey) {
    permanentRedirect(newsHref(item));
  }

  const commentsPromise = item
    ? supabase.from("comments").select("id, body, created_at, users(nickname, avatar_url)").eq("content_type", "news").eq("content_id", item.id).order("created_at", { ascending: true })
    : Promise.resolve({ data: [] as any[] });

  const [commentsResult, related, trending, prevItem, nextItem] = item
    ? await Promise.all([
        commentsPromise,
        loadRelated(supabase, item),
        loadTrending(supabase, item),
        loadSibling(supabase, item, "previous"),
        loadSibling(supabase, item, "next")
      ])
    : [await commentsPromise, [], [], null, null];

  const comments = ((commentsResult as any)?.data ?? []) as CommentRow[];
  const bodyBlocks = parseContentBlocks(String(item?.analysis ?? ""));
  const keyPoints = extractKeyPoints(String(item?.summary ?? ""), bodyBlocks);
  const paragraphIndexes = bodyBlocks.reduce<number[]>((acc, block, idx) => {
    if (block.type === "paragraph") acc.push(idx);
    return acc;
  }, []);
  const firstAdAfterIndex = paragraphIndexes.length >= 3 ? paragraphIndexes[2] : paragraphIndexes[1] ?? paragraphIndexes[0] ?? -1;
  const secondCandidate = paragraphIndexes.length >= 7 ? paragraphIndexes[Math.floor(paragraphIndexes.length * 0.66)] : -1;
  const secondAdAfterIndex = secondCandidate !== firstAdAfterIndex ? secondCandidate : -1;
  const readTime = estimateReadMinutes(`${item?.title ?? ""}\n${item?.summary ?? ""}\n${item?.analysis ?? ""}`);
  const normalizedCategories = cleanNewsCategories(item?.categories);
  const videoEmbedUrl = getSupportedVideoEmbedUrl(item?.video_url);
  const articleSchema = item
    ? buildNewsArticleJsonLd({
        canonicalPath: newsHref(item),
        title: item.title,
        description: item.summary,
        image: normalizeImageUrl(item.cover_url) || undefined,
        datePublished: item.published_at,
        dateModified: item.updated_at || item.published_at,
        authorName: "Redacción Sin Pelos",
        tags: [],
        category: normalizedCategories[0] ?? null,
        isNews: true
      })
    : null;

  return (
    <main>
      <Navbar />
      <section className="section news-article-page">
        <div className="container news-article-container">
          <Link className="button secondary news-back-link" href="/noticias">{copy.back}</Link>

          {item ? (
            <>
              <article className="card news-article-hero">
                <div className="news-article-cover">
                  {item.cover_url ? <NewsImage src={item.cover_url} alt={item.title} sizes="(max-width: 920px) 100vw, 1100px" priority /> : <div className="news-article-cover-fallback" />}
                  <div className="news-article-overlay" />
                </div>
                <div className="news-article-hero-content-block">
                  <div className="news-article-badges">
                    {normalizedCategories.slice(0, 3).map((cat) => <span key={cat} className="news-badge">{cat}</span>)}
                  </div>
                  <h1 className="news-article-title">{item.title}</h1>
                  {item.summary ? <p className="news-article-excerpt">{item.summary}</p> : null}
                </div>
                <div className="news-article-meta-row">
                  <div className="news-article-meta">
                    <span>{copy.published}: {formatDate(item.published_at, lang)}</span><span className="dot">·</span><span>{copy.readTime}: {readTime} min</span>
                  </div>
                  <div className="news-article-meta-actions"><ShareButtons path={newsHref(item)} text={item.title} /></div>
                </div>
              </article>

              <div className="news-article-layout">
                <article className="card news-article-main">
                  {keyPoints.length > 0 ? (
                    <section className="news-keypoints"><h2>{copy.keyPoints}</h2><ul>{keyPoints.map((point, idx) => <li key={`${idx}-${point.slice(0, 20)}`}>{point}</li>)}</ul></section>
                  ) : null}

                  {videoEmbedUrl ? (
                    <section className="news-video-section">
                      <h2 className="news-video-title">{copy.video}</h2>
                      <div className="news-video-player"><iframe src={videoEmbedUrl} title={`${copy.video}: ${item.title}`} loading="lazy" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
                    </section>
                  ) : null}

                  <div className="news-article-body">
                    {bodyBlocks.length > 0 ? bodyBlocks.map((block, idx) => (
                      <div key={`${block.type}-${idx}`}>
                        {block.type === "subheading" ? <h2>{block.text}</h2> : null}
                        {block.type === "paragraph" ? <p>{block.text}</p> : null}
                        {block.type === "quote" ? <blockquote>{block.text}</blockquote> : null}
                        {block.type === "list" ? <ul>{block.items.map((text, itemIdx) => <li key={`${itemIdx}-${text.slice(0, 16)}`}>{text}</li>)}</ul> : null}
                        {idx === firstAdAfterIndex ? <MidContentAdSlot placement="mid_content" section="noticias" /> : null}
                        {idx === secondAdAfterIndex ? <MidContentAdSlot placement="article_inline_2" section="noticias" compact /> : null}
                      </div>
                    )) : <p className="muted">{item.summary}</p>}
                  </div>

                  {item.source_url ? (
                    <section className="news-source-cta-wrap">
                      <div className="news-source-label">{copy.source}</div>
                      <a className="news-source-cta" href={item.source_url} target="_blank" rel="noreferrer" aria-label={copy.sourceCta}>
                        <span>{copy.sourceCta}</span>
                        <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M14 4h6v6h-2V7.41l-7.29 7.3-1.42-1.42 7.3-7.29H14V4ZM5 6h6v2H7v10h10v-4h2v6H5V6Z" fill="currentColor" /></svg>
                      </a>
                    </section>
                  ) : null}
                </article>

                <aside className="news-article-sidebar">
                  {related.length > 0 ? (
                    <section className="card news-article-side-card">
                      <h3>{copy.moreIn} {normalizedCategories[0] ?? "Sin Pelos"}</h3>
                      <div className="news-side-list">
                        {related.map((story) => (
                          <Link key={story.id} href={newsHref(story)} className="news-side-item">
                            <div className="news-side-thumb">{story.cover_url ? <NewsImage src={story.cover_url} alt={story.title} sizes="120px" /> : <div className="news-side-thumb-fallback" />}</div>
                            <div><p className="news-side-title">{story.title}</p><p className="muted news-side-date">{formatDate(story.published_at, lang)}</p></div>
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
                          <Link key={story.id} href={newsHref(story)} className="news-side-item">
                            <div className="news-side-thumb">{story.cover_url ? <NewsImage src={story.cover_url} alt={story.title} sizes="120px" /> : <div className="news-side-thumb-fallback" />}</div>
                            <div><p className="news-side-title">{story.title}</p><p className="muted news-side-date">{story.comments_count} {lang === "es" ? "comentarios" : "comments"}</p></div>
                          </Link>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </aside>
              </div>

              <section className="card news-comments-card">
                <div className="news-comments-head"><div><h3>{copy.commentsTitle}</h3><p className="muted">{copy.commentsHint}</p></div><span className="news-comments-count">{comments.length}</span></div>
                {comments.length > 0 ? (
                  <div className="news-comments-list">
                    {comments.map((comment) => {
                      const user = pickUser(comment.users);
                      return (
                        <article key={comment.id} className="news-comment">
                          <div className="news-comment-avatar"><Image src={user?.avatar_url ?? "/logo.png"} alt={user?.nickname ?? "avatar"} fill unoptimized sizes="36px" style={{ objectFit: "cover" }} /></div>
                          <div className="news-comment-body"><div className="news-comment-top"><strong>{user?.nickname ?? "Anónimo"}</strong><span className="muted">{formatDate(comment.created_at, lang)}</span></div><p>{comment.body}</p></div>
                        </article>
                      );
                    })}
                  </div>
                ) : <p className="muted">{copy.firstComment}</p>}
                <CommentComposer contentId={item.id} contentType="news" />
              </section>

              {prevItem || nextItem ? (
                <nav className="card news-next-prev" aria-label="Navegación de noticias">
                  {prevItem ? <Link href={newsHref(prevItem)} className="news-nav-link"><span className="muted">{copy.previous}</span><span className="news-nav-title">{prevItem.title}</span></Link> : <div className="news-nav-link news-nav-empty" />}
                  {nextItem ? <Link href={newsHref(nextItem)} className="news-nav-link news-nav-link-right"><span className="muted">{copy.next}</span><span className="news-nav-title">{nextItem.title}</span></Link> : <div className="news-nav-link news-nav-empty" />}
                </nav>
              ) : null}
            </>
          ) : (
            <div className="card" style={{ marginTop: 16 }}><p className="muted">{copy.notFound}</p></div>
          )}
        </div>
      </section>
      <Footer />
      {articleSchema ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleSchema) }} /> : null}
    </main>
  );
}
