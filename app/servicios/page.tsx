import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { BusinessInquiryForm } from "@/components/commercial/BusinessInquiryForm";
export const metadata:Metadata={title:"Producción audiovisual, eventos y podcasts | Prime Cut Studio · B&B",
 description:"Fotografía, cobertura, entrevistas en eventos, videos y producción de podcasts en Central Texas y proyectos en Puerto Rico.",
 alternates:{canonical:"/servicios"}};
const offers=[
 {name:"Fotografía + highlight",desc:"Cobertura fotográfica y video-resumen cinematográfico de eventos y celebraciones. Duración, entregables y logística sujetos a cotización.",id:"photo_video"},
 {name:"Producción de video",desc:"Videos comerciales, entrevistas, contenido para negocios, redes y producciones creativas. Grabación y edición según alcance.",id:"video"},
 {name:"Cobertura de eventos",desc:"Cámaras, audio y producción de momentos clave. También podemos llevar entrevistador para conversar con organizadores y vendedores.",id:"event_coverage"},
 {name:"Estudio y podcasts",desc:"Preparación de escenario, iluminación, grabación multicámara, audio y edición para entrevistas y podcasts.",id:"podcast_production"},
 {name:"Entrevistas con vendedores",desc:"Activación de eventos y presencia de marca: cámara más entrevistador, clips y cobertura de negocios.",id:"interviews"},
 {name:"Consulta de renta de equipos",desc:"Consulta por disponibilidad de cámaras, audio, iluminación y accesorios. Sin inventar inventario ni confirmar reservas sin contrato.",id:"equipment_rental"}
];
export default function ServiciosPage(){return <main className="app-enter"><Navbar/><section className="section"><div className="container" style={{maxWidth:1130}}>
 <header className="page-header-card" style={{padding:"clamp(24px,5vw,62px)",marginBottom:24}}>
  <p className="page-kicker">B&B ENTERTAINMENT HUB LLC · PRIME CUT STUDIO</p><h1 className="section-title">TU HISTORIA. NUESTRA PRODUCCIÓN.</h1>
  <p className="muted" style={{maxWidth:760}}>Producción audiovisual, fotografía y entrevistas para negocios, artistas y eventos. Trabajamos desde Central Texas con proyectos coordinados en Puerto Rico.</p>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link href="#cotizar" className="button">SOLICITA TU COTIZACIÓN</Link><Link href="/setup" className="button secondary">EQUIPO DE PRODUCCIÓN</Link></div>
 </header>
 <h2>Lo que podemos producir</h2>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,280px),1fr))",gap:14,marginBottom:28}}>{offers.map(o=><article className="card" key={o.id} style={{padding:22,minWidth:0}}><h3>{o.name}</h3><p className="muted">{o.desc}</p><a href={"#cotizar"} className="button secondary">Consultar disponibilidad</a></article>)}</div>
 <section className="card" style={{padding:24,marginBottom:22}}><h2 style={{marginTop:0}}>Así trabajamos</h2><p>Solicitud → conversación inicial → propuesta → contrato → producción → entrega. La fecha solo se confirma con acuerdo y disponibilidad; el precio depende del personal, horas, ubicación y edición.</p></section>
 <BusinessInquiryForm/>
 </div></section><Footer/></main>}