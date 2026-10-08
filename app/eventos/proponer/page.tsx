import type {Metadata} from "next";
import Link from "next/link";
import {Navbar} from "@/components/Navbar";
import {Footer} from "@/components/Footer";
import {CommunityEventForm} from "@/components/events/CommunityEventForm";
export const metadata:Metadata={title:"Publicar evento gratis | Sin Pelos",description:"Usuarios registrados y verificados pueden enviar sus eventos a revisión en Killeen, Central Texas y Puerto Rico.",alternates:{canonical:"/eventos/proponer"}};
export default function Proponer(){return <main><Navbar/><section className="section"><div className="container" style={{maxWidth:1050}}>
 <header className="page-header-card" style={{padding:"clamp(22px,5vw,50px)",marginBottom:24}}>
 <p className="page-kicker">AGENDA COMUNITARIA · PUBLICAR GRATIS</p><h1 className="section-title">QUE TODO EL MUNDO SE ENTERE</h1>
 <p className="muted">Cualquier usuario con cuenta registrada y correo confirmado puede proponer eventos de Killeen, Central Texas o Puerto Rico. Un administrador comprueba los datos antes de publicarlos.</p>
 <p>Publicar es gratis. Cuando el evento sea aprobado, puedes pagar para destacar tu actividad en la portada de la agenda.</p>
 <Link href="/eventos/promocionar" className="button secondary">Ver opciones de promoción</Link>
 </header><CommunityEventForm/></div></section><Footer/></main>}