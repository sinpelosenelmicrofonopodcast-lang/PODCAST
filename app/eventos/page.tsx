import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";
import { getPublishedEvents } from "@/lib/seo/content";
import { jsonLdScript } from "@/lib/seo/jsonld";
import { DEFAULT_OG_IMAGE } from "@/lib/seo/constants";

export const revalidate = 60;

export const metadata: Metadata = buildSeoMetadata({
  title: "Eventos | Sin Pelos en el Micrófono",
  description: "Directorio público de eventos: fecha, lugar y detalles.",
  path: "/eventos",
  image: DEFAULT_OG_IMAGE
});

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-PR", {
    timeZone: "America/Chicago",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export default async function EventosPage() {
  const events = await getPublishedEvents(200);
  const now=Date.now();
  const sponsored=events.filter(x=>x.promoted_until&&new Date(x.promoted_until).getTime()>now);
  const regular=events.filter(x=>!x.promoted_until||new Date(x.promoted_until).getTime()<=now);
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Eventos públicos",
    itemListElement: events.slice(0, 40).map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://www.sinpelosenelmicrofono.com/eventos/${encodeURIComponent(event.slug)}`
    }))
  };

  return (
    <main>
      <Navbar />
      <section className="section">
        <div className="container">
          <h1 className="section-title">Eventos</h1>
          <p className="muted">Agenda verificada de Killeen y Central Texas. Cualquier usuario registrado puede proponer un evento gratis.</p>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16,marginBottom:20}}>
            <Link className="button" href="/eventos/proponer">PROPONER UN EVENTO</Link>
            <Link className="button secondary" href="/eventos/promocionar">DESTACAR EVENTO</Link>
            <Link className="button secondary" href="/servicios">CONTRATAR COBERTURA</Link>
          </div>
          {events.length===0?<div className="card" style={{padding:24}}><h2>Estamos preparando la agenda.</h2><p>Por ahora no hay eventos verificados publicados. Envíanos una actividad con fecha, lugar y fuente oficial para evaluarla.</p><Link className="button secondary" href="/eventos/proponer">Enviar actividad</Link></div>:null}

          {sponsored.length>0?<section style={{marginTop:24}}>
            <p className="page-kicker">PUBLICIDAD · EVENTOS PATROCINADOS</p><h2>Destacados</h2>
            <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(280px,100%),1fr))",gap:14}}>
             {sponsored.map(x=><article className="card" key={x.id} style={{padding:20,border:"2px solid #ff6600"}}>
               <p style={{color:"#ff6600",fontWeight:900}}>PATROCINADO</p>
               {x.flyer_image_url?<img src={x.flyer_image_url} alt={x.title} loading="lazy" style={{width:"100%",aspectRatio:"16/9",objectFit:"cover",borderRadius:10}}/>:null}
               <p className="muted">{formatDate(x.start_datetime)} · {x.city}</p><h3>{x.title}</h3>
               <Link className="button" href={"/eventos/"+encodeURIComponent(x.slug)}>Ver evento</Link>
             </article>)}
            </div></section>:null}
          <section style={{marginTop:25}}><h2>Próximos eventos</h2>
            <div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(280px,100%),1fr))",gap:14}}>
             {regular.map(x=><article className="card" key={x.id} style={{padding:20,display:"grid",gap:10}}>
               {x.flyer_image_url?<img src={x.flyer_image_url} alt={x.title} loading="lazy" style={{width:"100%",aspectRatio:"16/9",objectFit:"cover",borderRadius:10}}/>:null}
               <p className="muted" style={{margin:0}}>{formatDate(x.start_datetime)} · {x.city}</p><h3 style={{margin:0}}>{x.title}</h3>
               <p className="muted">{x.description??"Evento de la comunidad"}</p>
               <Link className="button secondary" href={"/eventos/"+encodeURIComponent(x.slug)}>Ver detalles y fuente</Link>
             </article>)}
            </div></section>
          <div className="card" style={{padding:20,marginTop:24}}>
            <h2>¿Tienes un evento?</h2><p>Publicarlo es gratis para usuarios registrados con correo verificado. Tras revisión del administrador, puedes pagar para aparecer destacado.</p>
            <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link className="button" href="/eventos/proponer">PUBLICAR GRATIS</Link><Link className="button secondary" href="/eventos/promocionar">DESTACAR EVENTO</Link></div>
          </div>
        </div>
      </section>
      <Footer />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(schema) }} />
    </main>
  );
}
