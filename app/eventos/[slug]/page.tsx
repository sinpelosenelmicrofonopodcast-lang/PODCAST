import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata, eventSeoTemplate } from "@/lib/seo/meta";
import { getEventBySlug, getPublishedEvents } from "@/lib/seo/content";
import { buildEventJsonLd, jsonLdScript } from "@/lib/seo/jsonld";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const event = await getEventBySlug(params.slug);
  if (!event) {
    return buildSeoMetadata({
      title: "Evento no encontrado | Sin Pelos",
      description: "No encontramos el evento solicitado.",
      path: `/eventos/${encodeURIComponent(params.slug)}`
    });
  }
  const seo = eventSeoTemplate(event.title, event.description);
  return buildSeoMetadata({
    title: seo.title,
    description: seo.description,
    path: `/eventos/${encodeURIComponent(event.slug)}`,
    image: event.flyer_image_url || DEFAULT_OG_IMAGE
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-PR", {
    timeZone: "America/Chicago",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Render URLs from event descriptions as safe, tappable links without HTML injection.
function linkifyDescription(description: string) {
  const parts = description.split(/(https?:\/\/[^\s<>"']+)/gi);
  return parts.map((part, index) => {
    if (!/^https?:\/\//i.test(part)) return <span key={index}>{part}</span>;
    const url = part.replace(/[.,;!?]+$/, "");
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return <span key={index}>{part}</span>;
      }
    } catch {
      return <span key={index}>{part}</span>;
    }
    return (
      <span key={index}>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "#ff8533", textDecoration: "underline", overflowWrap: "anywhere" }}>
          {url}
        </a>{part.slice(url.length)}
      </span>
    );
  });
}

function podcastVideoUrl(description: string | null) {
  const id = description?.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/i)?.[1];
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

export default async function EventoDetallePage({ params }: { params: { slug: string } }) {
  const event = await getEventBySlug(params.slug);
  if (!event) notFound();

  const episodeUrl = podcastVideoUrl(event.description);
  const related = (await getPublishedEvents(20)).filter((row) => row.id !== event.id).slice(0, 6);
  const schema = buildEventJsonLd({
    canonicalPath: `/eventos/${encodeURIComponent(event.slug)}`,
    title: event.title,
    description: event.description,
    startDate: event.start_datetime,
    endDate: event.end_datetime,
    image: event.flyer_image_url,
    locationName: event.location_name,
    address: event.address,
    city: event.city,
    state: event.state,
    organizerName: event.organizer_name
  });

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <Link className="button secondary" href="/eventos">
            Volver a eventos
          </Link>
          <article className="card" style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {event.promoted_until&&new Date(event.promoted_until).getTime()>Date.now()?<p style={{color:"#ff6600",fontWeight:900}}>PUBLICIDAD · PATROCINADO</p>:null}
            <h1 style={{ margin: 0 }}>{event.title}</h1>
            {event.flyer_image_url ? (
              <img
                src={event.flyer_image_url}
                alt={event.title}
                loading="eager"
                style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 12 }}
              />
            ) : null}
            <p className="muted" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.7 }}>
              {linkifyDescription(event.description ?? "Evento comunitario.")}
            </p>
            <div className="muted" style={{ display: "grid", gap: 4 }}>
              <span>Inicio: {formatDateTime(event.start_datetime)}</span>
              {event.end_datetime ? <span>Fin: {formatDateTime(event.end_datetime)}</span> : null}
              {event.location_name ? <span>Lugar: {event.location_name}</span> : null}
              {event.city ? <span>Ciudad: {event.city}</span> : null}
            </div>
            {event.source_url?<p className="muted" style={{fontSize:13}}>Fuente: <a href={event.source_url} target="_blank" rel="noopener noreferrer">Consultar publicación original</a>. Confirma cambios con el organizador.</p>:null}
            {episodeUrl ? (
              <a className="button" href={episodeUrl} target="_blank" rel="noopener noreferrer">
                Ver episodio del podcast
              </a>
            ) : null}
            {event.external_url ? (
              <a className="button secondary" href={event.external_url} target="_blank" rel="noreferrer">
                Ver enlace oficial
              </a>
            ) : null}
          </article>

          {related.length > 0 ? (
            <section style={{ marginTop: 18 }}>
              <h2 className="section-title">Más eventos</h2>
              <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(280px,100%),1fr))" }}>
                {related.map((item) => (
                  <article key={item.id} className="card" style={{ display: "grid", gap: 8 }}>
                    <h3 style={{ margin: 0 }}>{item.title}</h3>
                    <p className="muted">{item.description ?? "Evento comunitario."}</p>
                    <a className="button secondary" href={`/eventos/${encodeURIComponent(item.slug)}`}>
                      Ver evento
                    </a>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }} />
    </main>
  );
}
