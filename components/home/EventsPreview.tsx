import Link from "next/link";
import type { HomeEvent } from "@/lib/homepageQueries";

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-PR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function location(event: HomeEvent) {
  const parts = [String(event.venue_name ?? "").trim(), String(event.city ?? "").trim()].filter(Boolean);
  return parts.join(" · ") || "Ubicacion por confirmar";
}

function eventHref(event: HomeEvent) {
  return event.ticket_url || event.info_url || event.join_url || `/eventos#evento-${encodeURIComponent(event.id)}`;
}

export function EventsPreview({ events }: { events: HomeEvent[] }) {
  return (
    <section className="home-media-section" aria-label="Eventos">
      <div className="home-media-section-head">
        <h2>EVENTOS</h2>
        <Link href="/eventos" className="home-muted">
          Ver agenda completa
        </Link>
      </div>

      <div className="home-events-grid">
        {events.length > 0 ? (
          events.slice(0, 4).map((event) => (
            <a key={event.id} href={eventHref(event)} className="card home-event-card" target="_blank" rel="noreferrer">
              <div className="home-event-thumb">
                {event.flyer_url ? <img src={event.flyer_url} alt={event.title} loading="lazy" /> : <div className="home-media-image-fallback" aria-hidden="true" />}
              </div>
              <div className="home-event-body">
                <h3 className="clamp-2">{event.title}</h3>
                <p>{formatDate(event.starts_at)}</p>
                <p className="home-muted">{location(event)}</p>
              </div>
            </a>
          ))
        ) : (
          <article className="card home-empty-state">
            <p>No hay eventos proximos cargados.</p>
          </article>
        )}
      </div>
    </section>
  );
}
