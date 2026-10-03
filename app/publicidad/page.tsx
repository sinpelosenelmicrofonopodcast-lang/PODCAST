import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AdRequestForm } from "@/components/AdRequestForm";
import { ui } from "@/lib/i18n";
import { getServerLang } from "@/lib/i18nServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function PublicidadPage() {
  const lang = getServerLang();
  void ui[lang]; // Page-specific copy is inside the form (client); keep server lang for consistent SSR.
  return (
    <main className="app-enter">
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <h1 className="section-title">Tu marca también puede sentarse en esta mesa</h1>
          <p>Conecta tu negocio con la comunidad de Sin Pelos en el Micrófono. Cuéntanos tu objetivo y preparamos una colaboración que encaje con el programa.</p>
          <div className="public-sponsor-options">
            <article className="card"><h2>Menciones en episodios</h2><p>Presenta tu negocio dentro de una conversación con Bito y Bebo.</p></article>
            <article className="card"><h2>Clips y redes</h2><p>Colaboraciones para llevar tu mensaje a nuestra comunidad en redes sociales.</p></article>
            <article className="card"><h2>Patrocinio del programa</h2><p>Presencia de marca en episodios, la página y proyectos acordados.</p></article>
          </div>
          <AdRequestForm />
        </div>
      </section>
      <Footer />
    </main>
  );
}
