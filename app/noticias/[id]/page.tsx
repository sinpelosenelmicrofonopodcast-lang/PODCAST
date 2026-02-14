import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabaseServer } from "@/lib/supabaseServer";
import { CommentComposer } from "@/components/CommentComposer";
import { ShareButtons } from "@/components/ShareButtons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const pickUser = (users: any) => (Array.isArray(users) ? users[0] : users);

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = supabaseServer();
  const { data: item } = await supabase
    .from("news_items")
    .select("id, title, summary, cover_url")
    .eq("id", params.id)
    .single();

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

  const { data: item } = await supabase
    .from("news_items")
    .select("id, title, summary, analysis, source_url, cover_url, categories, published_at")
    .eq("id", params.id)
    .single();

  const { data: comments } = await supabase
    .from("comments")
    .select("id, body, created_at, users(nickname, avatar_url)")
    .eq("content_type", "news")
    .eq("content_id", params.id)
    .order("created_at", { ascending: true });

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <Link className="button secondary" href="/noticias">
            Volver a noticias
          </Link>
          {item ? (
            <div className="card" style={{ marginTop: 16, display: "grid", gap: 16 }}>
              {item.cover_url ? (
                <div
                  style={{
                    width: "100%",
                    borderRadius: 12,
                    overflow: "hidden",
                    aspectRatio: "16 / 9",
                    background: "#0b0b0f"
                  }}
                >
                  <img
                    src={item.cover_url}
                    alt={item.title}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              ) : null}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(item.categories ?? []).map((cat: string) => (
                  <span key={cat} className="news-badge">
                    {cat}
                  </span>
                ))}
                <span className="muted" style={{ fontSize: 12 }}>
                  {item.published_at ? new Date(item.published_at).toLocaleDateString("es-PR") : ""}
                </span>
              </div>
              <h1 style={{ margin: 0 }}>{item.title}</h1>
              {item.summary ? <p className="muted">{item.summary}</p> : null}
              {item.analysis ? <p>{item.analysis}</p> : null}
              <ShareButtons path={`/noticias/${item.id}`} text={item.title} />
              {item.source_url ? (
                <a className="button secondary" href={item.source_url} target="_blank" rel="noreferrer">
                  Ver fuente
                </a>
              ) : null}
            </div>
          ) : (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="muted">Noticia no encontrada.</p>
            </div>
          )}

          <div className="card" style={{ marginTop: 20 }}>
            <h3>Comentarios</h3>
            {comments && comments.length > 0 ? (
              <div style={{ display: "grid", gap: 10 }}>
                {comments.map((comment) => {
                  const user = pickUser(comment.users);
                  return (
                    <div key={comment.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <img
                        src={user?.avatar_url ?? "/logo.png"}
                        alt={user?.nickname ?? "avatar"}
                        width={24}
                        height={24}
                        style={{ borderRadius: "50%", objectFit: "cover" }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.nickname ?? "Anónimo"}</div>
                        <div className="muted" style={{ fontSize: 13 }}>{comment.body}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">Sé el primero en comentar.</p>
            )}
            <CommentComposer contentId={params.id} contentType="news" />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
