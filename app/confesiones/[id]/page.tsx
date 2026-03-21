import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ConfesionComposer } from "@/components/ConfesionComposer";
import { CommentComposer } from "@/components/CommentComposer";
import { LazyContentComments } from "@/components/LazyContentComments";
import { supabaseServer } from "@/lib/supabaseServer";
import { buildConfessionPreview, getConfessionBannerUrl, getConfessionLink, getConfessionShareImageUrl } from "@/lib/confessions";

type ConfessionDetail = {
  id: string;
  title: string | null;
  body: string;
  category: string | null;
  region: string | null;
  is_anonymous: boolean | null;
  created_at: string | null;
  published_at: string | null;
  users: { nickname?: string | null; avatar_url?: string | null } | { nickname?: string | null; avatar_url?: string | null }[] | null;
};

function pickUser(users: ConfessionDetail["users"]) {
  return Array.isArray(users) ? users[0] : users;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

async function getConfession(id: string) {
  const supabase = supabaseServer();
  const result = await supabase
    .from("confessions")
    .select("id, title, body, category, region, is_anonymous, created_at, published_at, users(nickname, avatar_url)")
    .eq("id", id)
    .eq("level", "public")
    .eq("status", "published")
    .limit(1)
    .maybeSingle();

  if (result.error) throw new Error(result.error.message);
  return (result.data ?? null) as ConfessionDetail | null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const confession = await getConfession(String(params.id ?? "").trim());
  if (!confession) {
    return {
      title: "Confesiones | Sin Pelos en el Microfono"
    };
  }

  const title = confession.title?.trim() || "Confesion anonima";
  const description = `${buildConfessionPreview(confession.body, 150)} Lee la completa y publica la tuya completamente anonima.`;
  const image = getConfessionShareImageUrl();

  return {
    title: `${title} | Confesiones`,
    description,
    alternates: {
      canonical: getConfessionLink(confession.id)
    },
    openGraph: {
      title,
      description,
      url: getConfessionLink(confession.id),
      images: [{ url: image, width: 1024, height: 1024 }]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image]
    }
  };
}

export default async function ConfesionDetailPage({ params }: { params: { id: string } }) {
  const confession = await getConfession(String(params.id ?? "").trim());
  if (!confession) notFound();

  const author = pickUser(confession.users);
  const bannerUrl = getConfessionBannerUrl();
  const supabase = supabaseServer();
  const { data: comments } = await supabase
    .from("comments")
    .select("id")
    .eq("content_type", "confession")
    .eq("content_id", confession.id)
    .limit(2500);
  const repliesCount = Array.isArray(comments) ? comments.length : 0;

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <div className="confesionario-hero card">
            <div
              className="confesionario-banner"
              aria-hidden="true"
              style={
                bannerUrl
                  ? ({
                      ["--confesionario-banner-layer" as any]: `url("${bannerUrl}")`
                    } as any)
                  : undefined
              }
            />
            <div className="confesionario-overlay">
              <span className="badge">Confesion anonima</span>
              <h1 className="section-title" style={{ margin: 0 }}>
                {confession.title?.trim() || "Confesion cabrona"}
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Lee la historia completa y despues suelta la tuya completamente anonima.
              </p>
              <div className="conf-hero-actions">
                <Link className="button" href="/confesiones#enviar">
                  Tirar mi confesion
                </Link>
                <Link className="button secondary" href="/confesiones">
                  Ver todas
                </Link>
              </div>
            </div>
          </div>

          <article className="card conf-card" style={{ marginTop: 20 }}>
            <header className="conf-card-head">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <img
                  src={author?.avatar_url ?? "/logo.png"}
                  alt={author?.nickname ?? "avatar"}
                  width={40}
                  height={40}
                  style={{ borderRadius: "50%", objectFit: "cover" }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{confession.is_anonymous === false ? author?.nickname ?? "Usuario" : "Anonimo"}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {formatDate(confession.published_at ?? confession.created_at)}
                    {confession.category ? ` · ${confession.category}` : ""}
                    {confession.region ? ` · ${confession.region}` : ""}
                  </div>
                </div>
              </div>
            </header>

            <p className="muted conf-body" style={{ fontSize: 18, lineHeight: 1.7 }}>
              {confession.body}
            </p>

            <div className="conf-card-meta muted">
              <span>💬 {repliesCount} respuestas</span>
              <Link href="/confesiones">Volver a confesiones</Link>
            </div>

            <LazyContentComments contentId={confession.id} contentType="confession" initialCount={repliesCount} />
            <CommentComposer contentId={confession.id} contentType="confession" />
          </article>

          <div id="enviar">
            <ConfesionComposer />
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
