import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "El Setup de Sin Pelos | Cámaras, audio y luces que usamos",
  description: "Conoce el equipo real que usamos en Sin Pelos en el Micrófono y Prime Cut Studio: cámaras Canon, micrófonos Shure, audio y luces.",
  alternates: { canonical: "/setup" }
};
const sections = [
  { id:"camaras", title:"Cámaras y óptica", eyebrow:"VIDEO Y FOTOGRAFÍA",
    text:"La Canon R5 C es nuestra cámara principal para video y la Canon R6 Mark II para fotografías. Grabamos el podcast a 24 fps. Utilizamos óptica Canon RF y lentes de cine Rokinon EF.",
    items:["Canon EOS R5 C","Canon EOS R6 Mark II","Canon RF 24–105mm f/4 L IS","Canon RF 28–70mm f/2.8","Rokinon Cine EF 14 / 24 / 35 / 50 / 85 mm"]},
  { id:"audio", title:"Micrófonos y sonido", eyebrow:"LA VOZ AL FRENTE",
    text:"Nuestra mesa se apoya en cuatro Shure SM7B, procesamiento analógico y grabación multipista. El objetivo es inteligibilidad y carácter, no depender de presets milagrosos.",
    items:["4× Shure SM7B","RØDECaster Pro II","Universal Audio Apollo x6","Heritage Audio HA-73 EQ y SYMPH EQ","Warm Audio WA-76 y WA-2A"]},
  { id:"luces", title:"Iluminación", eyebrow:"LA ATMÓSFERA TAMBIÉN HABLA",
    text:"Combinamos key lights, iluminación de acento y fondos con LED para separar a Bebo, Bito y los invitados sin sacrificar tonos de piel.",
    items:["Aputure LS 600c Pro II + F10 Fresnel","Amaran COB 60x S","Amaran PT4c (2)","Aputure MC 4-Light Kit","GVM P80PRO (2)"]},
  { id:"movimiento", title:"Movimiento y apoyo", eyebrow:"PLANOS CON INTENCIÓN",
    text:"Para las producciones fuera de la mesa contamos con estabilización, soporte y accesorios según lo requiera cada historia.",
    items:["DJI RS 3 Pro + LiDAR","Manfrotto MVT502AM + cabezal MVH500A","PROAIM Dolly 12 ft","PROAIM Jib 9 ft","Zoom H6 Essential"]},
];
export default function SetupPage() {
  return <main className="app-enter"><Navbar/>
    <section className="section"><div className="container" style={{maxWidth:1140}}>
      <header className="page-header-card" style={{padding:"clamp(24px,5vw,62px)",marginBottom:28}}>
        <p className="page-kicker">DETRÁS DEL MICRÓFONO · NUESTRO EQUIPO REAL</p>
        <h1 className="section-title">EL SETUP DE <span style={{color:"#ff6600"}}>SIN PELOS</span></h1>
        <p className="muted" style={{maxWidth:740}}>Aquí no hay equipos inventados ni un catálogo comprado: estos son los modelos que forman parte de nuestra producción. Así se construye el sonido y la imagen detrás de las conversaciones.</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:12,marginTop:24}}>
          <Link className="button" href="#equipo">CONOCE EL EQUIPO</Link>
          <Link className="button secondary" href="/media-kit">COLABORACIONES CON MARCAS</Link>
        </div>
      </header>
      <section id="equipo" style={{display:"grid",gap:18}}>
        {sections.map(section=><article className="card" key={section.id} style={{padding:"clamp(20px,3vw,32px)"}}>
          <p className="page-kicker">{section.eyebrow}</p><h2 style={{fontSize:"clamp(26px,4vw,42px)",marginTop:4}}>{section.title}</h2>
          <p className="muted" style={{maxWidth:780}}>{section.text}</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,245px),1fr))",gap:9}}>
            {section.items.map(item=><div key={item} style={{padding:"13px 15px",border:"1px solid rgba(255,102,0,.25)",borderRadius:12,background:"rgba(255,102,0,.035)",overflowWrap:"anywhere"}}>{item}</div>)}
          </div>
        </article>)}
      </section>
      <section className="card" style={{padding:24,marginTop:26}}>
        <p className="page-kicker">TRANSPARENCIA</p>
        <h2>¿Dónde están los enlaces afiliados?</h2>
        <p>Actualmente esta guía es editorial: no contiene enlaces de comisión ni códigos de descuento patrocinados. Si incorporamos enlaces afiliados o colaboraciones, los identificaremos claramente junto a la recomendación. La inclusión de un modelo no implica patrocinio de su fabricante.</p>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link href="/media-kit" className="button">Patrocina esta guía</Link><Link href="/servicios" className="button secondary">Contrata producción de podcast</Link></div>
      </section>
    </div></section><Footer/></main>;
}
