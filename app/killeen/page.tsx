import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { getPublishedEpisodes } from "@/lib/seo/content";
import { getYouTubeVideoId } from "@/lib/youtube";
import { CANONICAL_SITE_URL } from "@/lib/seo/constants";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Podcast de Killeen y Central Texas | Entrevistas Sin Pelos",
  description: "Explora entrevistas de Sin Pelos en el Micrófono sobre Killeen y Central Texas: negocios, cultura boricua, gobierno, eventos, vivienda, Army y comunidad.",
  alternates: { canonical: "/killeen" },
  openGraph: {
    title: "Killeen y Central Texas: entrevistas, negocios y comunidad",
    description: "Bebo y Bito reúnen conversaciones y episodios ligados a Killeen y Central Texas.",
    url: CANONICAL_SITE_URL + "/killeen",
    type: "website"
  }
};

type SectionName = "comunidad" | "negocios" | "cultura" | "militar";
type LocalEpisode = { section: SectionName; number: number; id: string; title: string; summary: string };
const curated: LocalEpisode[] = [
  { section: "comunidad", number: 119, id: "6qRU0sqNyrI", title: "Ramón Alvarez: ¿hacia dónde crece Killeen?", summary: "Desarrollo de Killeen, downtown, vivienda, negocios y participación ciudadana." },
  { section: "comunidad", number: 116, id: "47HyahRnDGs", title: "José Segarra: calles, seguridad y economía", summary: "Conversación sobre infraestructura, negocios locales y el futuro de Killeen." },
  { section: "comunidad", number: 117, id: "hcfknt9p61Q", title: "Delsina West: participación y negocios locales", summary: "Elecciones municipales, participación ciudadana y apoyo al comercio de Killeen." },
  { section: "comunidad", number: 121, id: "TP1hfDSCBWA", title: "Killeen: política y comunidad", summary: "Bebo y Bito hablan de crecimiento de la ciudad, data centers y participación local." },
  { section: "comunidad", number: 93, id: "HcXeCsqwZvw", title: "Puerto Rico y Killeen: alcalde y city manager", summary: "Comparación de gobiernos municipales, decisiones y servicios para residentes." },
  { section: "negocios", number: 21, id: "3xo-EI-vzy0", title: "Alberto Hernández: comprar casa en Texas", summary: "Preguntas importantes para compradores y familias que buscan vivienda en Central Texas." },
  { section: "negocios", number: 29, id: "6h5GLAvU8Kc", title: "Sandwichon TX: de Ponce a Killeen", summary: "Mara cuenta cómo llevó el sabor boricua al negocio de comida en Killeen." },
  { section: "negocios", number: 35, id: "AWc5iekEvrw", title: "Orvil de OMB: comprar carro en Texas", summary: "Experiencias y errores que conviene conocer al comprar un vehículo." },
  { section: "negocios", number: 46, id: "_ex4oQli6eQ", title: "Kenneth: de una silla a Headlinez Barbershop", summary: "El trabajo detrás de construir una barbería y formar un equipo." },
  { section: "negocios", number: 51, id: "vGIozjpPoUY", title: "Yalmmyth Hernández: emprender en bienes raíces", summary: "Una joven agente comparte experiencias y prioridades al construir su carrera." },
  { section: "negocios", number: 52, id: "4-78TgiMDmA", title: "One Stop Hail Repair: granizo y seguros", summary: "Daños por granizo, aseguradoras y reclamaciones de vehículos." },
  { section: "negocios", number: 53, id: "UXCLIR_q5T0", title: "The Big Boss Sandwiches: del carro al food truck", summary: "Víctor relata su camino de Puerto Rico a un food truck en Killeen." },
  { section: "negocios", number: 69, id: "C0qdYWFiA6w", title: "Tri-City Barber Battle: barberos de Killeen", summary: "Yisos y Ching hablan de competencia, técnica y comunidad de barberos." },
  { section: "negocios", number: 84, id: "QF9rhPSq1_g", title: "Eleonora Santana: bienes raíces en Killeen", summary: "Experiencias de la propietaria y broker de NextHome Tropicana Realty." },
  { section: "negocios", number: 103, id: "wZrzOFycDd4", title: "Jaime Santiago: crear OrderChop", summary: "Emprendimiento tecnológico para restaurantes y decisiones de negocio." },
  { section: "negocios", number: 105, id: "Pcf2OharMKU", title: "La Parada 10: de empleados a propietarios", summary: "Cocina, contratos, permisos y sacrificios de levantar un negocio." },
  { section: "negocios", number: 135, id: "N5PyWg6joZI", title: "Castillo Boricua: comida y resiliencia", summary: "Juan Flores comparte el camino de su food truck en Copperas Cove." },
  { section: "cultura", number: 37, id: "7zL0eZ8NEYc", title: "FlakkoPR y JC Vázquez: música y barbería", summary: "Música, eventos, barbería y emprendimiento en una misma conversación." },
  { section: "cultura", number: 38, id: "p3S68IDDBWY", title: "Leo Stone: de República Dominicana a Killeen", summary: "Música, cocina, migración y vivencias de la vida militar en Texas." },
  { section: "cultura", number: 40, id: "yhFBJ6tAilc", title: "Roberto Cruz Rosa: boxeo boricua en Killeen", summary: "Desde su gimnasio en Killeen, habla de disciplina, retos y entrenamiento." },
  { section: "cultura", number: 43, id: "ggVum3q0kss", title: "El Parce de Killeen: humor e imitaciones", summary: "Comedia, voces y la experiencia de vivir lejos de Puerto Rico." },
  { section: "cultura", number: 50, id: "0PgFPuG8CZM", title: "Psicóloga Taisha: crianza y salud mental", summary: "Conversación sobre infancia, bienestar familiar y experiencias de la comunidad." },
  { section: "cultura", number: 77, id: "tn0wL0WYMlg", title: "Tony Rivera Burgos: música entre PR y Killeen", summary: "Experiencias de un músico independiente entre la isla y Texas." },
  { section: "cultura", number: 94, id: "NSnnz6YonAU", title: "ChrisDiel: de Puerto Rico a Texas", summary: "Barbería, música y empezar de nuevo después del huracán María." },
  { section: "cultura", number: 104, id: "KhX7MPJ11eU", title: "Hot Wheels en Killeen: carreras en familia", summary: "Autos a escala, categorías y una actividad de comunidad en Killeen." },
  { section: "cultura", number: 107, id: "OMvEM8G0KWg", title: "A Peso Completo: música y vida militar en Texas", summary: "Merengue, salsa, bachata y el camino de soldados a músicos." },
  { section: "cultura", number: 108, id: "-NhYQRZOIlY", title: "Mysia Chabert: comedia bilingüe en Killeen", summary: "Open mics, ansiedad escénica y hacer reír en español e inglés." },
  { section: "cultura", number: 114, id: "hM86HQOpLo0", title: "Gaby Alicea: comedia y presentación en Killeen", summary: "El oficio de la comedia y su conexión con el público boricua de Texas." },
  { section: "cultura", number: 118, id: "ZzbME9-SprU", title: "Chinchorreo Borinqueño: cultura en Killeen", summary: "Gastronomía, música y actividades para la comunidad puertorriqueña." },
  { section: "cultura", number: 133, id: "0GM0wJ41okY", title: "Wilfredo: Colombia, Puerto Rico y vida en Killeen", summary: "Cultura, inmigración, música y solidaridad desde Central Texas." },
  { section: "cultura", number: 134, id: "RyBGd6sH3zk", title: "Blend & Burnout Expo: carros y barbería", summary: "Car show, actividades de Halloween y barbería en Killeen." },
  { section: "militar", number: 33, id: "NZhTzzvqJqY", title: "Un Cubano del Army: Cuba, Puerto Rico y EE. UU.", summary: "Vida militar, cultura, política y experiencias entre países." },
  { section: "militar", number: 39, id: "88gIKsOt2F8", title: "SGM José Barbosa: del Army a los motores BMW", summary: "29 años de servicio y una nueva etapa vinculada al mundo del motor en Austin." },
  { section: "militar", number: 95, id: "e9ZU_1UU3iA", title: "SGM Edgar Fuentes: 31 años de Army", summary: "Servicio militar, decisiones de carrera y transición al retiro." }
];

const sections: Array<{ id: SectionName; title: string; subtitle: string }> = [
  { id: "comunidad", title: "Killeen: gobierno, crecimiento y comunidad", subtitle: "Conversaciones sobre decisiones municipales, participación cívica y el futuro de nuestra ciudad." },
  { id: "negocios", title: "Negocios, vivienda y emprendimiento", subtitle: "Historias de personas que montaron negocios, trabajaron en comercio y compartieron lecciones de vivienda y trabajo en Texas." },
  { id: "cultura", title: "Cultura, artistas, deporte y eventos", subtitle: "Entrevistas y capítulos donde la música, el humor, la cultura boricua y las actividades de Central Texas se encuentran." },
  { id: "militar", title: "Army, veteranos y transición", subtitle: "Experiencias de militares, retirados y familias vinculadas a la región de Fort Cavazos." }
];

type MoreEpisode = { slug: string; title: string; description: string; imageUrl: string | null };
const localTitlePattern = /killeen|central texas|copperas cove|fort cavazos|fort hood|bell county|harker heights|temple,? texas|\btexas\b/i;
function safeId(episode: { slug: string; youtube_url: string | null }) {
  return getYouTubeVideoId(episode.youtube_url) || (/^[A-Za-z0-9_-]{11}$/.test(String(episode.slug || "")) ? String(episode.slug) : "");
}

async function findOtherLocalEpisodes(): Promise<MoreEpisode[]> {
  try {
    const all = await getPublishedEpisodes(1200);
    const known = new Set(curated.map(row => row.id));
    const already = new Set<string>();
    const matches: MoreEpisode[] = [];
    for (const episode of all) {
      const title = String(episode.title || "").trim();
      if (!localTitlePattern.test(title)) continue;
      const videoId = safeId(episode);
      if (!videoId || known.has(videoId) || already.has(videoId)) continue;
      const slug = String(episode.slug || videoId).trim();
      if (!slug) continue;
      already.add(videoId);
      const description = String(episode.description || "").replace(/\s+/g, " ").trim();
      matches.push({
        slug,
        title,
        description: description.slice(0, 165) || "Una conversación de Bebo y Bito relacionada con Killeen y Texas.",
        imageUrl: episode.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      });
      if (matches.length >= 24) break;
    }
    return matches;
  } catch {
    // The verified curated archive remains available even if the episode DB is temporarily unavailable.
    return [];
  }
}

const pageUrl = CANONICAL_SITE_URL + "/killeen";
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": pageUrl + "#page",
      name: "Podcast y entrevistas de Killeen y Central Texas",
      url: pageUrl,
      inLanguage: "es",
      description: "Entrevistas de Sin Pelos en el Micrófono sobre Killeen, Central Texas, negocios, cultura y comunidad.",
      isPartOf: { "@type": "WebSite", name: "Sin Pelos en el Micrófono", url: CANONICAL_SITE_URL },
      mainEntity: {
        "@type": "ItemList",
        numberOfItems: curated.length,
        itemListElement: curated.map((episode, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: episode.title,
          url: `${CANONICAL_SITE_URL}/podcast/${episode.id}`
        }))
      }
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: CANONICAL_SITE_URL },
        { "@type": "ListItem", position: 2, name: "Killeen y Central Texas", item: pageUrl }
      ]
    }
  ]
};

export default async function KilleenPage() {
  const additional = await findOtherLocalEpisodes();
  return (
    <main className="app-enter">
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 1180 }}>
          <header className="page-header-card" style={{ padding: "clamp(24px,5vw,56px)", marginBottom: 22 }}>
            <p className="page-kicker">SIN PELOS EN EL MICRÓFONO · KILLEEN · CENTRAL TEXAS</p>
            <h1 className="section-title">La voz de Killeen y Central Texas, sin filtro</h1>
            <p className="muted" style={{ maxWidth: 850 }}>
              Bebo y Bito conversan con invitados y personas que tienen historias que contar: negocios de comida,
              vivienda, deportes, músicos, barberos, comediantes, cultura puertorriqueña, gobierno municipal
              y la comunidad militar. Nuestra conexión entre Puerto Rico y Texas está en estas conversaciones.
            </p>
            <p className="muted">
              Aquí reunimos {curated.length} entrevistas y capítulos seleccionados relacionados con Killeen
              y Central Texas, con enlaces al episodio completo. No es una lista de negocios recomendados:
              es un archivo editorial de las conversaciones del programa.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link className="button" href="/podcast">Ver catálogo completo</Link>
              <Link className="button secondary" href="/quiero-salir">Proponer una entrevista</Link>
            </div>
          </header>
          <nav aria-label="Temas de los episodios" className="card" style={{ padding: 18, marginBottom: 26 }}>
            <p style={{ fontWeight: 800, marginTop: 0 }}>Explora por tema</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {sections.map(s => (
                <a key={s.id} href={`#${s.id}`} className="button secondary" style={{ textDecoration: "none" }}>
                  {s.id === "comunidad" ? "Killeen y comunidad" : s.id === "negocios" ? "Negocios y vivienda" : s.id === "cultura" ? "Cultura y eventos" : "Army y veteranos"}
                </a>
              ))}
            </div>
          </nav>
          {sections.map(section => {
            const episodes = curated.filter(item => item.section === section.id);
            return (
              <section id={section.id} aria-labelledby={`title-${section.id}`} key={section.id} style={{ marginBottom: 35, scrollMarginTop: 100 }}>
                <h2 id={`title-${section.id}`} className="section-title">{section.title}</h2>
                <p className="muted" style={{ maxWidth: 900 }}>{section.subtitle}</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: 16 }}>
                  {episodes.map(episode => (
                    <article key={episode.id} className="card" style={{ padding: 16, minWidth: 0 }}>
                      <Link href={`/podcast/${episode.id}` as any} aria-label={`Ver episodio ${episode.number}: ${episode.title}`}>
                        <img
                          src={`https://i.ytimg.com/vi/${episode.id}/hqdefault.jpg`}
                          alt={`Portada del episodio ${episode.number}: ${episode.title}`}
                          loading="lazy"
                          width={480}
                          height={270}
                          style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 10 }}
                        />
                      </Link>
                      <p className="page-kicker" style={{ marginTop: 14 }}>EPISODIO {episode.number}</p>
                      <h3 style={{ marginTop: 4 }}>{episode.title}</h3>
                      <p className="muted">{episode.summary}</p>
                      <Link href={`/podcast/${episode.id}` as any} className="button secondary">Ver entrevista completa</Link>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
          {additional.length > 0 ? (
            <section id="mas" aria-labelledby="mas-locales" style={{ marginBottom: 35 }}>
              <h2 id="mas-locales" className="section-title">Más episodios sobre Killeen y Texas</h2>
              <p className="muted">Esta selección adicional se actualiza desde el archivo publicado cuando aparecen títulos relacionados con la región.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,250px),1fr))", gap: 16 }}>
                {additional.map(episode => (
                  <article key={episode.slug} className="card" style={{ padding: 16 }}>
                    {episode.imageUrl ? <img src={episode.imageUrl} alt={`Portada: ${episode.title}`} loading="lazy" width={480} height={270} style={{ display: "block", width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 10 }} /> : null}
                    <h3>{episode.title}</h3>
                    <p className="muted">{episode.description}</p>
                    <Link className="button secondary" href={`/podcast/${encodeURIComponent(episode.slug)}` as any}>Ver episodio</Link>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          <section className="card" style={{ padding: "clamp(20px,4vw,32px)", marginBottom: 24 }}>
            <h2 style={{ marginTop: 0 }}>Conversemos con más voces de Central Texas</h2>
            <p>
              Si eres artista, dueño de negocio, organizador de eventos, veterano o tienes una historia
              que nuestra comunidad debería conocer, puedes proponer una entrevista. El programa también
              cubre historias que conectan Killeen con Puerto Rico.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <Link href="/quiero-salir" className="button">Quiero salir en el podcast</Link>
              <Link href="/servicios" className="button secondary">Producción audiovisual y eventos</Link>
              <Link href="/eventos" className="button secondary">Eventos de Central Texas</Link>
            </div>
          </section>
          <section aria-labelledby="killeen-faq">
            <h2 id="killeen-faq">Preguntas frecuentes sobre Sin Pelos en Killeen</h2>
            <h3>¿Sin Pelos en el Micrófono está en Killeen?</h3>
            <p>El proyecto está basado en el área de Killeen, Central Texas, y mantiene una conexión activa con Puerto Rico.</p>
            <h3>¿Dónde están las entrevistas locales?</h3>
            <p>Las reunimos arriba por tema. También puedes consultar <Link href="/podcast">todos los episodios del podcast</Link>.</p>
            <h3>¿Cómo puedo participar como invitado?</h3>
            <p>Envía tu historia o idea en <Link href="/quiero-salir">Quiero salir</Link>.</p>
          </section>
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </main>
  );
}
