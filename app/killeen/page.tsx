import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ShareButtons } from "@/components/ShareButtons";
import { CANONICAL_SITE_URL } from "@/lib/seo/constants";

export const metadata: Metadata = {
  title: "Podcast latino en Killeen y Central Texas | Sin Pelos",
  description: "Sin Pelos en el Micrófono: entrevistas, negocios y cultura en español con Bebo y Bito desde Killeen para la comunidad de Central Texas.",
  alternates: { canonical: "/killeen" },
  openGraph: {
    title: "Podcast latino en Killeen y Central Texas",
    description: "Entrevistas e historias reales con Bebo y Bito desde Killeen, Texas.",
    url: CANONICAL_SITE_URL + "/killeen", type: "website"
  }
};

const destacados = [
  { href: "/podcast/ggVum3q0kss" as const,
    title: "El Parce de Killeen: historias y realidades",
    description: "Una conversación sobre experiencias y vivencias de una voz de la comunidad de Killeen." },
  { href: "/podcast/3xo-EI-vzy0" as const,
    title: "Comprando casa en Texas: guía con un experto",
    description: "Consejos y preguntas sobre vivienda y decisiones importantes de la vida en Texas." },
  { href: "/podcast/QF9rhPSq1_g" as const,
    title: "Eleonora Santana: imperio de bienes raíces",
    description: "Emprendimiento y experiencias en el mundo de los bienes raíces." }
];

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "CollectionPage",
      name: "Podcast latino en Killeen y Central Texas",
      url: CANONICAL_SITE_URL + "/killeen",
      description: "Episodios y entrevistas de Sin Pelos en el Micrófono con temas de Killeen y Texas.",
      inLanguage: "es",
      isPartOf: { "@type": "WebSite", name: "Sin Pelos en el Micrófono", url: CANONICAL_SITE_URL },
      mainEntity: { "@type": "ItemList",
        itemListElement: destacados.map((p, i) => ({
          "@type": "ListItem", position: i + 1, name: p.title, url: CANONICAL_SITE_URL + p.href
        })) } },
    { "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: CANONICAL_SITE_URL },
        { "@type": "ListItem", position: 2, name: "Killeen y Central Texas", item: CANONICAL_SITE_URL + "/killeen" }
      ] }
  ]
};

export default function KilleenPage() {
  return <main className="app-enter">
    <Navbar />
    <section className="section"><div className="container" style={{ maxWidth: 1050 }}>
      <header className="page-header-card" style={{ padding: "clamp(24px,5vw,58px)", marginBottom: 24 }}>
        <p className="page-kicker">KILLEEN · CENTRAL TEXAS · SIN PELOS EN EL MICRÓFONO</p>
        <h1 className="section-title">Podcast en español desde Killeen, Texas</h1>
        <p className="muted">Somos Bebo y Bito. En Sin Pelos en el Micrófono hablamos sin libreto de cultura,
          música, emprendimiento y experiencias que conectan a Puerto Rico con la comunidad latina de Texas.
          Descubre conversaciones relacionadas con Killeen y Central Texas.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link className="button" href="/podcast">Todos los episodios</Link>
          <Link className="button secondary" href="/quiero-salir">Quiero ser invitado</Link>
        </div>
      </header>
      <section aria-labelledby="killeen-interviews">
        <h2 id="killeen-interviews">Historias y entrevistas relacionadas con Texas</h2>
        <p className="muted">Estas conversaciones abordan negocios, vivienda, proyectos y experiencias reales.
          Es una forma de conocer el archivo de Sin Pelos y las voces que nos acompañan.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 16, marginBottom: 28 }}>
          {destacados.map((p) => <article className="card" key={p.href} style={{ padding: 22 }}>
            <h3 style={{ marginTop: 0 }}>{p.title}</h3>
            <p className="muted">{p.description}</p>
            <Link className="button secondary" href={p.href}>Ver episodio</Link>
            <ShareButtons path={p.href} text={p.title} />
          </article>)}
        </div>
      </section>
      <section className="card" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>Una conversación para nuestra comunidad</h2>
        <p>Conversamos con artistas, empresarios, profesionales y personas con experiencias que compartir.
          Si tienes una historia, puedes proponerte como invitado. También realizamos producciones de video,
          fotografía y cobertura de eventos en Central Texas.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link className="button" href="/quiero-salir">Proponer entrevista</Link>
          <Link className="button secondary" href="/servicios">Servicios de producción</Link>
          <Link className="button secondary" href="/eventos">Eventos</Link>
        </div>
      </section>
      <section>
        <h2>Preguntas frecuentes</h2>
        <h3>¿Dónde se produce Sin Pelos en el Micrófono?</h3>
        <p>El proyecto está basado en el área de Killeen, Texas, con vínculos y conversaciones en Puerto Rico.</p>
        <h3>¿Cómo puedo participar?</h3>
        <p>Envía tu propuesta desde <Link href="/quiero-salir">Quiero salir</Link>.</p>
        <h3>¿Dónde están los episodios?</h3>
        <p>Consulta nuestro <Link href="/podcast">catálogo de entrevistas y conversaciones</Link>.</p>
      </section>
    </div></section>
    <Footer />
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
  </main>;
}
