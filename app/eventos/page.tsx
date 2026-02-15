import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AuthWall } from "@/components/AuthWall";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 3600;

type LiveEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  join_url: string | null;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "Sin fecha definida";
  return new Date(value).toLocaleString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export default async function EventosPage() {
  const supabase = supabaseServer();
  const { data: events } = await supabase
    .from("live_events")
    .select("id, title, description, starts_at, join_url")
    .order("starts_at", { ascending: true });

  return (
    <main>
      <AuthWall />
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Eventos en Vivo</h1>
          <p className="muted">Audio rooms, debates y Q&A con enfoque adulto.</p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 20 }}>
            {(events as LiveEvent[] | null)?.map((event) => (
              <div key={event.id} className="card">
                <h3 style={{ marginTop: 0 }}>{event.title}</h3>
                <p className="muted">{event.description ?? "Debate en tiempo real."}</p>
                <p className="muted" style={{ marginTop: -6 }}>{formatDateTime(event.starts_at)}</p>
                {event.join_url ? (
                  <a className="button secondary" href={event.join_url} target="_blank" rel="noreferrer">
                    Reservar lugar
                  </a>
                ) : (
                  <button className="button secondary" type="button">
                    Pronto
                  </button>
                )}
              </div>
            ))}
            {(!events || events.length === 0) ? <p className="muted">No hay eventos cargados aún.</p> : null}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
