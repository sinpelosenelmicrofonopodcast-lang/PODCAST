import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <Navbar />
      <section className="section">
        <div className="container">
          <article className="card not-found-card">
            <span className="not-found-code" aria-hidden="true">404</span>
            <h1>Eso no está aquí, mano.</h1>
            <p>
              El link se fue por otro lado, cambió de dirección o alguien lo mandó pa&apos;l carajo. Lo importante es que no tienes que quedarte perdido.
            </p>
            <div className="not-found-actions">
              <Link className="button" href="/">Volver al inicio</Link>
              <Link className="button secondary" href="/podcast">Ver episodios</Link>
              <Link className="button secondary" href="/blog">Desde el Micrófono</Link>
            </div>
          </article>
        </div>
      </section>
      <Footer />
    </main>
  );
}
