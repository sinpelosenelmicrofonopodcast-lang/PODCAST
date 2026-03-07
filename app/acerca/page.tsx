import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Acerca de Sin Pelos en el Micrófono",
  description: "Quiénes somos, misión editorial y enfoque de SPM News.",
  path: "/acerca"
});

export default function AcercaPage() {
  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Acerca de Sin Pelos en el Micrófono</h1>
          <p className="muted">
            Plataforma editorial y multimedia enfocada en noticias, análisis, podcast y conversación abierta.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <a className="button secondary" href="/noticias">
              Noticias
            </a>
            <a className="button secondary" href="/podcast">
              Podcast
            </a>
            <a className="button secondary" href="/contacto">
              Contacto
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
