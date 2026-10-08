import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { AdRequestForm } from "@/components/AdRequestForm";
export const metadata: Metadata = {
  title: "Media Kit | Sin Pelos en el Micrófono",
  description: "Paquetes de patrocinio, espacios web, podcast y newsletter de Sin Pelos en el Micrófono.",
  alternates: { canonical: "/media-kit" }
};
const offers = [
  { name: "Comunidad", price: "$99", details: ["Presencia de marca en la web", "Enlace de negocio", "Reporte de clics e impresiones registrados"] },
  { name: "Presencia", price: "$249", details: ["Espacio publicitario web", "Integración mensual de newsletter disponible", "Reporte de campaña"] },
  { name: "Premium", price: "$499", details: ["Presencia web", "Integración newsletter", "Mención comercial acordada en episodio", "Reporte de campaña"] }
];
export default function MediaKit() {
  return <div className="media-kit-page app-enter">
    <div className="media-kit-nav"><Navbar /></div>
    <main className="section"><div className="container" style={{maxWidth:1100}}>
      <header className="page-header-card" style={{padding:"clamp(22px,5vw,55px)",marginBottom:28}}>
        <p className="page-kicker">MEDIA KIT · SIN PELOS EN EL MICRÓFONO</p>
        <h1 className="section-title">Tu marca merece una conversación real.</h1>
        <p className="muted">Con Bito y Bebo conectamos cultura, historias y comunidad entre Puerto Rico y Texas. Podcast, noticias, web y redes, con publicidad identificada claramente.</p>
        <div className="media-kit-actions" style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          <Link href="#cotizar" className="button">Solicitar propuesta</Link>
          <Link href="/publicidad" className="button secondary">Espacios disponibles</Link>
        </div>
      </header>
      <h2>Varios puntos de contacto para tu marca</h2>
      <div className="public-sponsor-options">
        <article className="card"><h3>Podcast</h3><p>Integraciones y menciones comerciales en episodios, según acuerdo editorial.</p></article>
        <article className="card"><h3>Noticias y web</h3><p>Banners, patrocinadores de sección y publicidad diferenciada del contenido periodístico.</p></article>
        <article className="card"><h3>Comunidad</h3><p>Amplificación seleccionada en redes y newsletter, según inventario disponible.</p></article>
      </div>
      <h2 style={{marginTop:36}}>Paquetes de lanzamiento</h2>
      <div className="media-kit-pricing" style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:14}}>
        {offers.map(o=><article className="card" key={o.name} style={{padding:22,minWidth:0}}>
          <h3>{o.name}</h3><p style={{fontSize:38,fontWeight:900,margin:"8px 0"}}>{o.price}<small style={{fontSize:13}}> / mes</small></p>
          <ul style={{paddingLeft:20,lineHeight:1.6}}>{o.details.map(d=><li key={d}>{d}</li>)}</ul>
          <Link href="#cotizar" className="button">Me interesa</Link>
        </article>)}
      </div>
      <p className="muted" style={{fontSize:13}}>Precios iniciales propuestos en USD, sujetos a disponibilidad y cotización. No garantizamos vistas, ventas ni clics. La producción audiovisual adicional se cotiza aparte.</p>
      <section className="card" style={{padding:24,marginBlock:28}}>
        <h2>Proceso de trabajo</h2>
        <p>Solicitud → propuesta → aprobación → campaña → reporte verificable. Entregamos fechas, ubicaciones, impresiones registradas y clics cuando estén disponibles. No inventamos métricas.</p>
      </section>
      <section id="cotizar" className="media-kit-contact" style={{scrollMarginTop:110}}>
        <h2>Cuéntanos sobre tu negocio</h2>
        <AdRequestForm />
      </section>
    </div></main>
    <div className="media-kit-footer"><Footer /></div>
  </div>;
}
