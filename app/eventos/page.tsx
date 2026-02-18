"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { useProtectedUser } from "@/lib/useProtectedUser";

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

export default function EventosPage() {
  const { checking, userId } = useProtectedUser();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LiveEvent[]>([]);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("live_events")
        .select("id, title, description, starts_at, join_url")
        .order("starts_at", { ascending: true });
      if (!mounted) return;
      setEvents((data as LiveEvent[]) ?? []);
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Eventos en Vivo</h1>
          <p className="muted">Audio rooms, debates y Q&A con enfoque adulto.</p>
          {checking || loading ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Cargando eventos...</p>
            </div>
          ) : null}
          {!checking && !loading ? (
            <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 20 }}>
              {events.map((event) => (
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
              {events.length === 0 ? <p className="muted">No hay eventos cargados aún.</p> : null}
            </div>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}

