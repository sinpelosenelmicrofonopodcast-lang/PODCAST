import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

const events = [
  {
    id: "e1",
    title: "Town Hall: ¿quién decide lo que es verdad?",
    date: "Viernes · 9:00 PM"
  },
  {
    id: "e2",
    title: "Debate en vivo: medios vs ciudadanía",
    date: "Domingo · 8:00 PM"
  }
];

export default function EventosPage() {
  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Eventos en Vivo</h1>
          <p className="muted">Audio rooms, debates y Q&A con enfoque adulto.</p>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 20 }}>
            {events.map((event) => (
              <div key={event.id} className="card">
                <h3 style={{ marginTop: 0 }}>{event.title}</h3>
                <p className="muted">{event.date}</p>
                <button className="button secondary" type="button">
                  Reservar lugar
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
