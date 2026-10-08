"use client";
import Link from "next/link";
import { useEffect,useState } from "react";
import { supabase } from "@/lib/supabaseClient";
type Data={template:{subject_template:string;preheader_template:string;html_template:string;is_active:boolean}|null;campaign:{subject:string;status:string;created_at:string}|null;subscribers:number};
export default function SponsorNewsletterAdmin(){
 const [data,setData]=useState<Data|null>(null);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
 useEffect(()=>{let live=true;(async()=>{const t=(await supabase.auth.getSession()).data.session?.access_token;
  if(!t){if(live){setError("Sesión no disponible.");setLoading(false);}return;}
  const r=await fetch("/api/admin/newsletter-sponsor",{headers:{Authorization:`Bearer ${t}`},cache:"no-store"});
  const j=await r.json().catch(()=>({}));if(!live)return;
  if(!r.ok||!j.ok)setError(j.error??"No se pudo cargar.");else setData(j);
  setLoading(false);
 })();return()=>{live=false};},[]);
 return <div style={{display:"grid",gap:16}}>
  <header><p className="page-kicker">NEWSLETTER · VENTAS</p><h1>Edición patrocinable</h1>
   <p className="muted">Borrador interno · No se ha enviado a suscriptores.</p></header>
  {loading?<p>Cargando…</p>:error?<p role="alert">{error}</p>:data?<div className="card" style={{padding:20}}>
   <p><strong>Plantilla:</strong> {data.template?.subject_template??"No encontrada"}</p>
   <p><strong>Campaña:</strong> {data.campaign?.status??"No registrada"}</p>
   <p><strong>Suscriptores activos:</strong> {data.subscribers}</p>
   <p className="muted">La plantilla se mantiene inactiva para que los envíos automáticos no incluyan anuncios vacíos. Para enviarla habrá que definir patrocinador, aprobar contenido y garantizar la opción de baja.</p>
   {data.template?.html_template?<iframe title="Vista previa del newsletter patrocinable" sandbox="" srcDoc={data.template.html_template}
       style={{width:"100%",height:670,border:"1px solid #555",borderRadius:10,background:"#fff"}}/>:null}
   <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:18}}>
    <Link href="/newsletter/patrocinios" className="button secondary">Vista pública</Link>
    <Link href="/admin/newsletter" className="button secondary">Lista de suscriptores</Link>
   </div>
  </div>:null}
 </div>;
}
