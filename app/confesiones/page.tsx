import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ConfesionComposer } from "@/components/ConfesionComposer";
import { CommentComposer } from "@/components/CommentComposer";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";
import { LazyContentComments } from "@/components/LazyContentComments";
import { supabaseServer } from "@/lib/supabaseServer";
import { canonicalUrl } from "@/lib/seo/constants";
import { getConfessionBannerUrl, getConfessionShareImageUrl } from "@/lib/confessions";

type CategoryKey = "amor" | "trabajo" | "familia" | "sociedad" | "politica";

type ConfessionRow = {
  id: string;
  body: string;
  created_at: string | null;
  published_at: string | null;
  is_anonymous: boolean | null;
  author_id: string | null;
};

const confessionsShareImage = getConfessionShareImageUrl();

export const metadata: Metadata = {
  title: "Confesiones Cabronas | Sin Pelos en el Microfono",
  description: "Lee confesiones anonimas, vacila con la comunidad y publica la tuya completamente anonima en Sin Pelos.",
  alternates: {
    canonical: canonicalUrl("/confesiones")
  },
  openGraph: {
    title: "Confesiones Cabronas",
    description: "Secretos, infidelidades y locuras. Entra a leer y publica la tuya completamente anonima.",
    url: canonicalUrl("/confesiones"),
    images: [{ url: confessionsShareImage, width: 1024, height: 1024 }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Confesiones Cabronas",
    description: "Lee confesiones anonimas y publica la tuya completamente anonima.",
    images: [confessionsShareImage]
  }
};

const CATEGORY_META: { key: CategoryKey; label: string }[] = [
  { key: "amor", label: "Amor" },
  { key: "trabajo", label: "Trabajo" },
  { key: "familia", label: "Familia" },
  { key: "sociedad", label: "Sociedad" },
  { key: "politica", label: "Política" }
];

const KEYWORDS: Record<CategoryKey, string[]> = {
  amor: ["amor", "pareja", "novio", "novia", "ex", "infidel", "celo", "relación", "sexo"],
  trabajo: ["trabajo", "jefe", "oficina", "empleo", "compañero", "turno", "negocio", "empresa"],
  familia: ["familia", "mamá", "mama", "papá", "papa", "hijo", "hija", "hermano", "casa"],
  sociedad: ["sociedad", "gente", "vecino", "vecina", "barrio", "calle", "comunidad", "país"],
  politica: ["política", "politica", "gobierno", "alcalde", "senador", "partido", "elección", "ley"]
};

function normalizeCategory(input?: string): CategoryKey | "all" {
  if (!input) return "all";
  const n = String(input).toLowerCase();
  if (n === "amor" || n === "trabajo" || n === "familia" || n === "sociedad" || n === "politica") return n;
  return "all";
}

function detectCategory(body: string): CategoryKey {
  const text = body.toLowerCase();
  for (const item of CATEGORY_META) {
    if (KEYWORDS[item.key].some((kw) => text.includes(kw))) return item.key;
  }
  return "sociedad";
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default async function ConfesionesPage({
  searchParams
}: {
  searchParams?: { tema?: string };
}) {
  const supabase = supabaseServer();
  const selectedCategory = normalizeCategory(searchParams?.tema);
  const bannerUrl = getConfessionBannerUrl();

  const { data: dataRows } = await supabase
    .from("confessions")
    .select("id, body, created_at, published_at, is_anonymous, author_id")
    .eq("level", "public")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(60);

  const rows = (dataRows ?? []) as ConfessionRow[];
  const authorIds = Array.from(new Set(rows.map((item) => String(item.author_id ?? "").trim()).filter(Boolean)));
  let authorsById = new Map<string, { nickname?: string | null; avatar_url?: string | null }>();
  if (authorIds.length > 0) {
    const { data: authorRows } = await supabase.from("users").select("id, nickname, avatar_url").in("id", authorIds);
    authorsById = new Map(
      ((authorRows ?? []) as Array<any>).map((row) => [String(row.id ?? ""), { nickname: row.nickname ?? null, avatar_url: row.avatar_url ?? null }])
    );
  }
  const withCategory = rows.map((item) => ({
    ...item,
    topic: detectCategory(item.body)
  }));

  const filtered = selectedCategory === "all" ? withCategory : withCategory.filter((item) => item.topic === selectedCategory);

  const countsByCategory = new Map<CategoryKey, number>();
  withCategory.forEach((item) => countsByCategory.set(item.topic, (countsByCategory.get(item.topic) ?? 0) + 1));

  const confessionIds = filtered.map((x) => x.id);
  let commentsCountByContent = new Map<string, number>();
  if (confessionIds.length > 0) {
    const { data: comments } = await supabase
      .from("comments")
      .select("id, content_id")
      .eq("content_type", "confession")
      .in("content_id", confessionIds)
      .limit(2500);
    commentsCountByContent = new Map<string, number>();
    (comments ?? []).forEach((row: any) => commentsCountByContent.set(row.content_id, (commentsCountByContent.get(row.content_id) ?? 0) + 1));
  }

  const popular = [...withCategory]
    .map((item) => ({ ...item, comments: commentsCountByContent.get(item.id) ?? 0 }))
    .sort((a, b) => b.comments - a.comments)
    .slice(0, 4);

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
              <span className="badge">Confesionario</span>
              <h1 className="section-title" style={{ margin: 0 }}>
                Confesiones Cabronas
              </h1>
              <p className="muted" style={{ margin: 0 }}>
                Secretos, infidelidades y locuras. Lee la que esta corriendo y tira la tuya completamente anonima para vacilar.
              </p>
              <div className="conf-hero-actions">
                <a href="#enviar" className="button">
                  Enviar mi confesión
                </a>
                <Link className="button secondary" href="/zona-cruda">
                  Ver confesiones crudas
                </Link>
              </div>
            </div>
          </div>

          <div className="conf-rules-grid">
            <article className="card conf-rule-card">
              <h3 style={{ marginTop: 0 }}>Área pública (gratis)</h3>
              <p className="muted">Confesiones moderadas, anónimas y abiertas a conversación de la comunidad.</p>
            </article>
            <article className="card conf-rule-card">
              <h3 style={{ marginTop: 0 }}>Zona cruda (miembros)</h3>
              <p className="muted">Contenido sin filtro y respuestas directas. Entrada bajo responsabilidad de adultos 21+.</p>
            </article>
          </div>

          <div className="conf-filter-row" aria-label="Filtros de confesiones">
            <Link className={selectedCategory === "all" ? "chip active" : "chip"} href="/confesiones">
              Todas ({withCategory.length})
            </Link>
            {CATEGORY_META.map((cat) => (
              <Link
                key={cat.key}
                className={selectedCategory === cat.key ? "chip active" : "chip"}
                href={`/confesiones?tema=${cat.key}`}
              >
                {cat.label} ({countsByCategory.get(cat.key) ?? 0})
              </Link>
            ))}
          </div>

          <div id="enviar">
            <ConfesionComposer />
          </div>

          {filtered.length > 0 ? (
            <>
              {popular.length > 0 ? (
                <div className="card conf-popular" style={{ marginTop: 18 }}>
                  <h3 style={{ marginTop: 0 }}>Top confesiones de la semana</h3>
                  <div className="conf-popular-list">
                    {popular.map((item) => (
                      <Link key={item.id} href={`/confesiones/${item.id}`} className="conf-popular-item">
                        <span className="pill">{CATEGORY_META.find((c) => c.key === item.topic)?.label ?? "Tema"}</span>
                        <strong className="clamp-1">{item.body}</strong>
                        <span className="muted">{item.comments} respuestas</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid conf-grid" style={{ marginTop: 20 }}>
                {filtered.map((item) => {
                  const author = authorsById.get(String(item.author_id ?? "").trim()) ?? null;
                  const repliesCount = commentsCountByContent.get(item.id) ?? 0;
                  const topicLabel = CATEGORY_META.find((c) => c.key === item.topic)?.label ?? "Sociedad";
                  return (
                    <article id={`conf-${item.id}`} key={item.id} className="card conf-card">
                      <header className="conf-card-head">
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          <img
                            src={author?.avatar_url ?? "/logo.png"}
                            alt={author?.nickname ?? "avatar"}
                            width={32}
                            height={32}
                            style={{ borderRadius: "50%", objectFit: "cover" }}
                          />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{item.is_anonymous === false ? author?.nickname ?? "Usuario" : "Anonimo"}</div>
                            <div className="muted" style={{ fontSize: 12 }}>{formatDate(item.published_at ?? item.created_at)}</div>
                          </div>
                        </div>
                        <span className="pill">{topicLabel}</span>
                      </header>

                      <p className="muted conf-body">{item.body}</p>

                      <div className="conf-card-meta muted">
                        <span>💬 {repliesCount} respuestas</span>
                        <Link href={`/confesiones/${item.id}`}>Ver completa</Link>
                      </div>

                      <AdminDeleteButton table="confessions" id={item.id} label="Eliminar confesión" />

                      <LazyContentComments contentId={item.id} contentType="confession" initialCount={repliesCount} />
                      <CommentComposer contentId={item.id} contentType="confession" />
                    </article>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="card conf-empty" style={{ marginTop: 20 }}>
              <h3 style={{ marginTop: 0 }}>Aquí aún no hay confesiones públicas...</h3>
              <p className="muted">Pero sí hay cosas que puedes hacer ahora mismo:</p>
              <ul className="conf-empty-list">
                <li>Enviar tu propia confesión.</li>
                <li>Entrar a la Zona Cruda para confesiones sin filtro.</li>
                <li>Explorar temas: amor, trabajo, familia, sociedad y política.</li>
              </ul>
              <div className="home-cta-row" style={{ marginTop: 12 }}>
                <a href="#enviar" className="button">Enviar mi confesión</a>
                <Link className="button secondary" href="/zona-cruda">Ver confesiones crudas</Link>
              </div>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
