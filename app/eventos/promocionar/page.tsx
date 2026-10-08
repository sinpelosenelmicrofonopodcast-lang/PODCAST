import type {Metadata} from "next";
import Link from "next/link";
import {Navbar} from "@/components/Navbar";
import {Footer} from "@/components/Footer";
import {PromotionRequestForm} from "@/components/events/PromotionRequestForm";
export const metadata:Metadata={title:"Promocionar eventos | Sin Pelos",description:"Destaca tu evento por 3, 7 o 14 días. La publicación estándar es gratis.",alternates:{canonical:"/eventos/promocionar"}};
const offers=[{days:3,usd:15},{days:7,usd:29},{days:14,usd:49}];
export default function Promocionar(){return <main><Navbar/><section className="section"><div className="container" style={{maxWidth:1040}}>
 <header className="page-header-card" style={{padding:"clamp(22px,5vw,52px)",marginBottom:25}}>
  <p className="page-kicker">AGENDA COMERCIAL · PUBLICIDAD IDENTIFICADA</p><h1 className="section-title">PON TU EVENTO EN EL TOP</h1>
  <p className="muted">Publicar es gratis. Un evento aprobado puede aparecer primero, identificado como «PATROCINADO». La promoción no influye en nuestra aprobación editorial.</p>
  <Link className="button secondary" href="/eventos/proponer">PUBLICAR GRATIS</Link></header>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,230px),1fr))",gap:14,marginBottom:24}}>
  {offers.map(p=><article className="card" key={p.days} style={{padding:22}}><h2>{p.days} días</h2>
   <p style={{fontSize:36,fontWeight:900}}>{"$"}{p.usd}</p><p>Posición destacada en la agenda durante el periodo contratado.</p></article>)}
 </div>
 <PromotionRequestForm/>
 <p className="muted" style={{marginTop:18}}>Precios promocionales de lanzamiento sujetos a confirmación. Sin garantía de asistencia, vistas o ventas. Pagos coordinados mediante factura; esta página no procesa tarjetas. Para patrocinar el podcast: <Link href="/media-kit">Media Kit</Link>.</p>
 </div></section><Footer/></main>}