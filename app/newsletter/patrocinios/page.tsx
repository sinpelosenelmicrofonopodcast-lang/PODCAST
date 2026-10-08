import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
export const metadata: Metadata = {
 title:"Patrocina el newsletter | Sin Pelos",
 description:"Espacio publicitario identificado en el newsletter de Sin Pelos en el Micrófono.",
 alternates:{canonical:"/newsletter/patrocinios"}
};
export default function SponsorNewsletter(){
 return <main className="app-enter"><Navbar/><section className="section"><div className="container" style={{maxWidth:940}}>
   <header className="page-header-card" style={{padding:"clamp(24px,5vw,58px)",marginBottom:22}}>
    <p className="page-kicker">NEWSLETTER · PATROCINADORES</p>
    <h1 className="section-title">La conversación también llega al correo.</h1>
    <p className="muted">Un resumen editorial de episodios, noticias y conversaciones con un espacio publicitario visible y diferenciado.</p>
    <Link href="/media-kit#cotizar" className="button">SOLICITAR PROPUESTA</Link>
   </header>
   <div className="card" style={{padding:"clamp(20px,3vw,36px)",maxWidth:720,margin:"auto"}}>
    <p className="page-kicker">EJEMPLO ILUSTRATIVO — NO ES UN ENVÍO REAL</p>
    <h2>La semana sin filtro</h2><p>Historias de la mesa, lo nuevo del podcast y contexto sobre lo que está pasando.</p>
    <p className="muted">Desde el Micrófono: conoce las historias detrás de nuestros invitados.</p>
    <div style={{marginBlock:24,padding:22,border:"2px solid #ff6600",borderRadius:14}}>
      <p style={{color:"#ff6600",fontWeight:900}}>PUBLICIDAD · ESPACIO PATROCINADO</p>
      <h3>Tu marca puede aparecer aquí</h3>
      <p>Mensaje aprobado, una propuesta real para nuestra comunidad y enlace de seguimiento cuando corresponda.</p>
      <Link className="button secondary" href="/media-kit#cotizar">Quiero patrocinar</Link>
    </div>
    <p className="muted" style={{fontSize:13}}>Cada envío real requiere contenidos aprobados, consentimiento de los suscriptores y un mecanismo funcional de baja.</p>
   </div>
 </div></section><Footer/></main>;
}
