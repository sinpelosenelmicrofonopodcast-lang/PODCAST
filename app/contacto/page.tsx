import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Contacto | Sin Pelos en el Micrófono",
  description: "Canales de contacto editorial, colaboraciones y prensa.",
  path: "/contacto"
});

export default function ContactoPage() {
  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Contacto</h1>
          <p className="muted">
            Para notas de prensa, colaboraciones y consultas editoriales escribe a: contacto@sinpelosenelmicrofono.com
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
            <a className="button secondary" href="/acerca">
              Acerca
            </a>
            <a className="button secondary" href="/eventos">
              Eventos
            </a>
            <a className="button secondary" href="/noticias">
              Noticias
            </a>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
