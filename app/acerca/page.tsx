import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { buildSeoMetadata } from "@/lib/seo/meta";
export const metadata = buildSeoMetadata({title:"Conócenos | Bebo y Bito — Sin Pelos en el Micrófono", description:"Conoce a Bebo y Bito, los anfitriones de Sin Pelos en el Micrófono.",path:"/acerca"});
export const dynamic = "force-dynamic";
type Bio = {slug:string;title:string;intro:string;biography:string;photo_url:string};
const defaults: Bio[] = [
{slug:"bito",title:"Bito: lo bueno, lo malo y lo feo",intro:"Bito es de esos tipos que pueden estar hablando de relaciones, masculinidad, dinero, música o sociedad y, cinco minutos después, convertir la conversación más seria del mundo en un vacilón.",biography:"Boricua, radicado en Texas y co-host de Sin Pelos en el Micrófono. Bito cuestiona todo, produce detrás de las cámaras y mezcla humor, tecnología y conversaciones reales.",photo_url:"/images/hosts/bito-sin-pelos-en-el-microfono.webp"},
{slug:"bebo",title:"Bebo: presencia, vacilón y cero miedo al micrófono",intro:"Bebo es la voz que abre la puerta y hace que la conversación arranque. Tiene presencia, calle, humor y esa habilidad de hablar con un invitado como si llevaran años conociéndose.",biography:"Host principal de Sin Pelos en el Micrófono. Bebo marca el ritmo de la conversación y mezcla historias, entrevistas y vacilón.",photo_url:"/images/hosts/bebo-sin-pelos-en-el-microfono.webp"}];
export default async function AcercaPage(){
 let bios=defaults;
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(url && key){const db=createClient(url,key,{auth:{persistSession:false}});const {data,error}=await db.from("host_biographies").select("slug,title,intro,biography,photo_url").in("slug",["bito","bebo"]);if(!error&&data){bios=defaults.map(b=>({...b,...(data.find(d=>d.slug===b.slug)??{})}));}}
 return <main><Navbar/><section className="section"><div className="container" style={{maxWidth:980}}>
 <span className="badge">Bebo y Bito · Sin Pelos en el Micrófono</span><h1 className="section-title">Conócenos</h1>
 <p className="muted" style={{fontSize:18,lineHeight:1.7}}>Dos boricuas, una mesa y conversaciones sin pelos en la lengua.</p>
 <nav style={{display:"flex",gap:16,marginBottom:30}}><a className="button" href="#bito">Conoce a Bito</a><a className="button secondary" href="#bebo">Conoce a Bebo</a></nav>
 {bios.map(b=><article className="card" key={b.slug} id={b.slug} style={{marginBottom:28,scrollMarginTop:150,padding:24}}>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:28,alignItems:"start"}}>
 <Image src={b.photo_url.startsWith("/")?b.photo_url:"/images/hosts/"+b.slug+"-sin-pelos-en-el-microfono.webp"} alt={b.slug==="bito"?"Bito":"Bebo"} width={520} height={650} style={{width:"100%",height:"auto",borderRadius:12}}/>
 <div><h2>{b.title}</h2><p style={{fontSize:18,lineHeight:1.75}}>{b.intro}</p><div className="muted" style={{whiteSpace:"pre-line",lineHeight:1.85}}>{b.biography}</div></div>
 </div></article>)}</div></section><Footer/></main>;
}