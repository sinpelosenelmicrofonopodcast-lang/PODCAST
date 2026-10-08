"use client";
import { useState,type FormEvent } from "react";
import { usePathname } from "next/navigation";
const services=[
 ["video","Producción de video"],["photo_video","Fotografía + video"],["interviews","Entrevistas en eventos"],
 ["podcast_production","Producción de podcast"],["event_coverage","Cobertura de eventos"],["equipment_rental","Consulta de renta de equipo"],
 ["event_listing","Proponer evento a la agenda"],["other","Otro servicio"]
] as const;
export function BusinessInquiryForm({defaultType="video",heading="Cuéntanos tu proyecto"}:{defaultType?:string;heading?:string}){
 const pathname=usePathname()??"/servicios";const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const submit=async(event:FormEvent<HTMLFormElement>)=>{
  event.preventDefault();const form=event.currentTarget;setBusy(true);setError("");setSuccess("");
  const fd=new FormData(form),body=Object.fromEntries(fd.entries());
  const params=new URLSearchParams(window.location.search);
  try{
   const res=await fetch("/api/commercial/inquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,source_path:pathname,utm_source:params.get("utm_source")||""})});
   const json=await res.json().catch(()=>({}));
   if(!res.ok||!json.ok)throw new Error(json.error||"No se pudo enviar. Intenta de nuevo.");
   form.reset();setSuccess(json.message||"Solicitud recibida.");
  }catch(e){setError(e instanceof Error?e.message:"No se pudo enviar.");}finally{setBusy(false);}
 };
 return <form className="card" onSubmit={submit} style={{padding:"clamp(20px,4vw,34px)",display:"grid",gap:14,maxWidth:840,scrollMarginTop:110}} id="cotizar">
  <h2 style={{margin:0}}>{heading}</h2><p className="muted" style={{margin:0}}>Recibimos los detalles y preparamos una propuesta. No se cobra ni se reserva una fecha desde este formulario.</p>
  <div style={{position:"absolute",width:1,height:1,overflow:"hidden"}} aria-hidden="true"><label>No completar<input name="company_fax" tabIndex={-1} autoComplete="off"/></label></div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,250px),1fr))",gap:12}}>
   <label>Nombre completo *<input className="input" name="full_name" maxLength={120} required autoComplete="name"/></label>
   <label>Correo electrónico *<input className="input" type="email" name="email" maxLength={254} required autoComplete="email"/></label>
   <label>Teléfono / WhatsApp<input className="input" name="phone" maxLength={35} autoComplete="tel"/></label>
   <label>Negocio u organización<input className="input" name="business_name" maxLength={140} autoComplete="organization"/></label>
   <label>Servicio *<select className="select" name="inquiry_type" defaultValue={defaultType} required>{services.map(([id,t])=><option key={id} value={id}>{t}</option>)}</select></label>
   <label>Fecha aproximada<input className="input" type="date" name="event_date"/></label>
   <label>Ciudad y lugar<input className="input" name="location" placeholder="Killeen, TX / Puerto Rico" maxLength={160}/></label>
   <label>Presupuesto orientativo<select className="select" name="budget_range" defaultValue=""><option value="">Por definir</option><option value="under_500">Menos de $500</option><option value="500_1000">$500–$1,000</option><option value="1000_2500">$1,000–$2,500</option><option value="over_2500">Más de $2,500</option></select></label>
  </div>
  <label>Detalles del proyecto o evento *<textarea className="textarea" name="details" rows={5} minLength={10} maxLength={4000} placeholder="¿Qué necesitas, para cuándo y qué quieres conseguir?" required/></label>
  <p className="muted" style={{fontSize:12,margin:0}}>Utilizaremos tus datos solo para responder a la solicitud. <a href="/privacy">Privacidad</a>.</p>
  {error?<p role="alert" style={{color:"var(--danger)",margin:0}}>{error}</p>:null}
  {success?<p role="status" style={{color:"var(--success)",margin:0}}>{success}</p>:null}
  <button className="button" type="submit" disabled={busy}>{busy?"Enviando…":"SOLICITAR COTIZACIÓN"}</button>
 </form>;
}