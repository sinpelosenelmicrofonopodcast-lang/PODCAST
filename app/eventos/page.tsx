import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";
import { getPublishedEvents } from "@/lib/seo/content";
import { jsonLdScript } from "@/lib/seo/jsonld";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";

export const revalidate = 180;

export const metadata: Metadata = buildSeoMetadata({
  title: "Eventos | Sin Pelos en el Micrófono",
  description: "Directorio público de eventos: fecha, lugar y detalles.",
  path: "/eventos",
  image: DEFAULT_OG_IMAGE
});

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default async function EventosPage() {
  const events = await getPublishedEvents(80);
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Eventos públicos",
    itemListElement: events.slice(0, 40).map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://www.sinpelosenelmicrofono.com/eventos/${encodeURIComponent(event.slug)}`
    }))
  };

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Eventos</h1>
          <p className="muted">Agenda pública de la comunidad con fechas y enlaces oficiales.</p>
          <div className="grid" style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fit,minmax(min(320px,100%),1fr))" }}>
            {events.map((event) => (
              <article key={event.id} className="card" style={{ display: "grid", gap: 10 }}>
                {event.flyer_image_url ? (
                  <img
                    src={event.flyer_image_url}
                    alt={event.title}
                    loading="lazy"
                    style={{ width: "100%", aspectRatio: "16/9", objectFit: "cover", borderRadius: 10 }}
                  />
                ) : null}
                <span className="muted">{formatDate(event.start_datetime)}</span>
                <h2 style={{ margin: 0 }}>{event.title}</h2>
                <p className="muted">{event.description ?? "Evento comunitario."}</p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <a className="button secondary" href={`/eventos/${encodeURIComponent(event.slug)}`}>
                    Ver detalles
                  </a>
                  {event.external_url ? (
                    <a className="button secondary" href={event.external_url} target="_blank" rel="noreferrer">
                      Enlace externo
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }} />
    </main>
  );
}
