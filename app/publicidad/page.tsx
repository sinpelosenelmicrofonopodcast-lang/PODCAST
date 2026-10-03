import type { Metadata } from "next";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AdRequestForm } from "@/components/AdRequestForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const salesTitle = "Anúnciate con Sin Pelos | Patrocinios y publicidad";
const salesDescription =
  "Patrocina Sin Pelos en el Micrófono con presencia en la web, noticias, podcast y redes. Campañas con ubicaciones claras y métricas de impresiones y clics.";

export const metadata: Metadata = {
  title: salesTitle,
  description: salesDescription,
  alternates: { canonical: "/publicidad" },
  openGraph: {
    title: salesTitle,
    description: salesDescription,
    url: "/publicidad",
    type: "website",
    images: [{ url: "/og-share.png", width: 1200, height: 630, alt: "Anúnciate con Sin Pelos en el Micrófono" }]
  },
  twitter: {
    card: "summary_large_image",
    title: salesTitle,
    description: salesDescription,
    images: ["/og-share.png"]
  }
};

const inventory = [
  {
    id: "SPM-AD-01",
    name: "Top Banner",
    format: "970×90 desktop · 320×100 mobile",
    value: "Máxima visibilidad debajo de la navegación. Ideal para campañas de alcance."
  },
  {
    id: "SPM-AD-02",
    name: "Featured Sponsor",
    format: "Bloque premium responsive",
    value: "Presencia editorial diferenciada para un sponsor principal o campaña destacada."
  },
  {
    id: "SPM-AD-03",
    name: "Section Sponsor",
    format: "Header de sección",
    value: "Patrocina áreas específicas como Noticias, Podcast, Puerto Rico, Texas o contenido editorial."
  },
  {
    id: "SPM-AD-04",
    name: "Article Inline",
    format: "Responsive dentro de lectura",
    value: "Publicidad integrada entre bloques del artículo sin disfrazarse de contenido editorial."
  },
  {
    id: "SPM-AD-05",
    name: "Desktop Sticky",
    format: "300×600 recomendado",
    value: "Alta permanencia visual en desktop sin tapar el contenido principal."
  },
  {
    id: "SPM-AD-06",
    name: "Podcast + Web",
    format: "Mención + presencia digital",
    value: "Combina conversación, episodio, página y distribución social en una sola campaña."
  }
];

const tiers = [
  ["Presenting Sponsor", "La presencia de mayor jerarquía: marca asociada al proyecto o a una campaña principal."],
  ["Featured Sponsor", "Alta exposición en posiciones premium y secciones seleccionadas."],
  ["Section Sponsor", "Patrocinio contextual por área, categoría o tipo de contenido."],
  ["Article Sponsor", "Presencia identificada dentro de artículos o coberturas específicas."],
  ["Community Partner", "Formato pensado para negocios locales que quieren crecer junto a la comunidad."]
];

export default function PublicidadPage() {
  return (
    <main className="app-enter">
      <Navbar />

      <section className="section">
        <div className="container" style={{ maxWidth: 1120 }}>
          <header className="page-header-card" style={{ padding: "clamp(28px, 5vw, 64px)", marginBottom: 28 }}>
            <p className="page-kicker">PUBLICIDAD · PATROCINIOS · COLABORACIONES</p>
            <h1 className="section-title" style={{ maxWidth: 820 }}>
              Tu marca no necesita otro logo perdido. Necesita atención, contexto y resultados.
            </h1>
            <p className="muted" style={{ maxWidth: 780, fontSize: "1.05rem" }}>
              Sin Pelos conecta podcast, noticias, contenido editorial, web y redes en un mismo ecosistema. Diseñamos campañas con ubicaciones claras, una presentación que respeta la marca del anunciante y medición real de rendimiento.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
              <a className="button" href="#solicitar-campana">Solicitar propuesta</a>
              <a className="button secondary" href="#inventario">Ver inventario publicitario</a>
            </div>
          </header>

          <section style={{ marginBottom: 34 }} aria-labelledby="why-spm">
            <div className="home-media-section-head"><h2 id="why-spm">Una campaña, varios puntos de contacto</h2></div>
            <div className="public-sponsor-options">
              <article className="card"><h3>Podcast</h3><p>Integraciones y menciones dentro de conversaciones que la audiencia decide escuchar.</p></article>
              <article className="card"><h3>Website + Noticias</h3><p>Inventario publicitario identificado, responsive y colocado donde realmente se ve.</p></article>
              <article className="card"><h3>Redes sociales</h3><p>Extensiones de campaña para que el mensaje no se quede en una sola pantalla.</p></article>
            </div>
          </section>

          <section id="inventario" style={{ marginBottom: 34, scrollMarginTop: 120 }} aria-labelledby="inventory-title">
            <div className="home-media-section-head">
              <div>
                <p className="page-kicker">INVENTARIO VENDIBLE</p>
                <h2 id="inventory-title">Espacios diseñados para monetizar sin dañar la experiencia</h2>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 }}>
              {inventory.map((slot) => (
                <article className="card" key={slot.id} style={{ padding: 20 }}>
                  <p className="muted" style={{ margin: 0, fontSize: 12, letterSpacing: ".08em" }}>{slot.id}</p>
                  <h3 style={{ marginBottom: 6 }}>{slot.name}</h3>
                  <strong style={{ display: "block", marginBottom: 10 }}>{slot.format}</strong>
                  <p className="muted" style={{ margin: 0 }}>{slot.value}</p>
                </article>
              ))}
            </div>
          </section>

          <section style={{ marginBottom: 34 }} aria-labelledby="measurement-title">
            <div className="home-media-section-head"><h2 id="measurement-title">Lo que una campaña puede medir</h2></div>
            <div className="public-sponsor-options">
              <article className="card"><h3>Impresiones</h3><p>Cuántas veces el anuncio fue servido y visto en sus ubicaciones contratadas.</p></article>
              <article className="card"><h3>Clics y CTR</h3><p>Interacciones con el anuncio y porcentaje de respuesta sobre las impresiones registradas.</p></article>
              <article className="card"><h3>Ubicación y periodo</h3><p>Rendimiento separado por placement, sección, ruta y fechas de campaña.</p></article>
            </div>
            <p className="muted" style={{ marginTop: 12 }}>
              Los resultados se reportan con datos registrados por los espacios publicitarios de Sin Pelos. No vendemos números inventados ni métricas que no podamos respaldar.
            </p>
          </section>

          <section style={{ marginBottom: 34 }} aria-labelledby="tier-title">
            <div className="home-media-section-head"><h2 id="tier-title">Niveles de patrocinio</h2></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
              {tiers.map(([name, description]) => (
                <article className="card" key={name} style={{ padding: 20 }}>
                  <h3>{name}</h3>
                  <p className="muted">{description}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="card" style={{ padding: "clamp(22px, 4vw, 40px)", marginBottom: 34 }} aria-labelledby="fit-title">
            <p className="page-kicker">NO TODO NEGOCIO NECESITA LO MISMO</p>
            <h2 id="fit-title">La ubicación se escoge por objetivo, no por llenar espacios</h2>
            <p className="muted">
              Una campaña de reconocimiento puede vivir en el banner principal. Una oferta local puede funcionar mejor dentro de Noticias o una sección geográfica. Una marca que quiere asociación profunda puede combinar podcast, web y redes. Primero definimos el objetivo; después decidimos dónde debe aparecer la marca.
            </p>
          </section>

          <section id="solicitar-campana" style={{ scrollMarginTop: 120 }} aria-labelledby="request-title">
            <div className="home-media-section-head">
              <div>
                <p className="page-kicker">HABLEMOS DE NEGOCIO</p>
                <h2 id="request-title">Cuéntanos qué quieres lograr</h2>
                <p className="muted">Con esa información preparamos una propuesta según formato, duración, ubicación y alcance.</p>
              </div>
            </div>
            <AdRequestForm />
          </section>
        </div>
      </section>

      <Footer />
    </main>
  );
}
