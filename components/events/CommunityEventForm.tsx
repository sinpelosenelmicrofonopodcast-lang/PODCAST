"use client";
import {useEffect,useState,type FormEvent} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
type Row={id:string;title:string;review_status:string;review_notes:string|null;published_event_id:string|null};
export function CommunityEventForm(){
 const [state,setState]=useState<"loading"|"guest"|"unverified"|"ready">("loading"),[items,setItems]=useState<Row[]>([]);
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 const token=async()=>(await supabase.auth.getSession()).data.session?.access_token??"";
 const load=async()=>{
  const {data}=await supabase.auth.getUser();if(!data.user)return setState("guest");
  if(!data.user.email_confirmed_at)return setState("unverified");
  setState("ready");const t=await token();const r=await fetch("/api/event-board/submissions",{headers:{Authorization:"Bearer "+t},cache:"no-store"});
  const j=await r.json().catch(()=>({}));if(r.ok)setItems(j.items??[]);
 };
 useEffect(()=>{void load();},[]);
 const submit=async(e:FormEvent<HTMLFormElement>)=>{
  e.preventDefault();setBusy(true);setError("");setSuccess("");const form=e.currentTarget;
  try{
   const body=Object.fromEntries(new FormData(form).entries());const start=new Date(String(body.start_datetime??"")),end=new Date(String(body.end_datetime??""));
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))throw Error("Revisa fechas.");
   const t=await token();const r=await fetch("/api/event-board/submissions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},
     body:JSON.stringify({...body,start_datetime:start.toISOString(),end_datetime:end.toISOString()})});
   const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(j.error||"No se pudo enviar.");
   setSuccess(j.message);form.reset();await load();
  }catch(e){setError(e instanceof Error?e.message:"Error enviando.");}finally{setBusy(false);}
 };
 if(state==="loading")return <p>Cargando tu cuenta…</p>;
 if(state!=="ready")return <div className="card" style={{padding:25}}>
  <h2>Cualquier usuario registrado puede participar</h2><p>Necesitas correo electrónico confirmado para proponer eventos y evitar información falsa.</p>
  {state==="guest"?<Link className="button" href="/login?next=%2Feventos%2Fproponer">INICIAR SESIÓN / REGISTRARSE</Link>:<p>Confirma tu dirección mediante el correo de registro y vuelve aquí.</p>}
 </div>;
 return <div style={{display:"grid",gap:24}}>
  <form className="card" onSubmit={submit} style={{padding:"clamp(20px,4vw,32px)",display:"grid",gap:15}}>
   <h2>Envía tu evento gratis</h2><p className="muted">El equipo comprobará la evidencia, fecha y organizador. Hasta que aprueben el evento, nadie podrá verlo públicamente.</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,250px),1fr))",gap:12}}>
    <label>Título *<input className="input" name="title" required minLength={6} maxLength={180}/></label>
    <label>Categoría *<select className="select" name="category" defaultValue="comunidad">
      <option value="comunidad">Comunidad</option><option value="musica">Música</option><option value="familia">Familia</option><option value="negocios">Negocios</option><option value="deportes">Deportes</option><option value="cultura">Cultura</option><option value="otros">Otros</option></select></label>
    <label>Fecha y hora de inicio *<input className="input" type="datetime-local" name="start_datetime" required/></label>
    <label>Fecha y hora de fin *<input className="input" type="datetime-local" name="end_datetime" required/></label>
    <label>Nombre del lugar *<input className="input" name="location_name" required maxLength={160}/></label>
    <label>Dirección<input className="input" name="address" maxLength={240}/></label>
    <label>Ciudad *<input className="input" name="city" required placeholder="Killeen / Belton / Temple" maxLength={90}/></label>
    <label>Región<select className="select" name="state" defaultValue="TX"><option value="TX">Texas</option><option value="PR">Puerto Rico</option></select></label>
    <label>Organizador responsable *<input className="input" name="organizer_name" required minLength={3} maxLength={150}/></label>
    <label>Correo de contacto *<input className="input" name="organizer_email" type="email" required maxLength={254}/></label>
    <label>Teléfono del organizador<input className="input" name="organizer_phone" maxLength={40}/></label>
    <label>URL oficial verificable HTTPS *<input className="input" type="url" name="official_url" required placeholder="https://organizador.com/evento"/></label>
    <label>Flyer alojado en tu sitio (URL)<input className="input" type="url" name="flyer_image_url" placeholder="https://..."/></label>
   </div>
   <label>Descripción real (mínimo 30 caracteres) *<textarea className="textarea" name="description" rows={5} minLength={30} maxLength={5000} required placeholder="Qué ocurre, a qué hora, costos de entrada, entradas, restricciones…"/></label>
   <label>Evidencia adicional<textarea className="textarea" name="evidence_notes" rows={2} maxLength={1200} placeholder="Otros enlaces o información para verificar el evento"/></label>
   <p className="muted" style={{fontSize:12}}>Confirmas que tienes derecho a compartir flyer y datos del evento. El pago por publicidad no compra aprobación. <Link href="/privacy">Privacidad</Link>.</p>
   {error?<p role="alert" style={{color:"var(--danger)"}}>{error}</p>:null}{success?<p role="status" style={{color:"var(--success)"}}>{success}</p>:null}
   <button className="button" disabled={busy}>{busy?"Enviando…":"ENVIAR PARA APROBACIÓN"}</button>
  </form>
  <section className="card" style={{padding:24}}><h2>Mis eventos</h2>
   {items.length===0?<p>Aún no has propuesto actividades.</p>:items.map(x=><div key={x.id} style={{borderTop:"1px solid #555",padding:12}}>
    <strong>{x.title}</strong><p>{x.review_status==="approved"?"Aprobado":x.review_status==="rejected"?"Rechazado":"En revisión"}</p>
    {x.review_notes?<p>{x.review_notes}</p>:null}{x.published_event_id?<Link href="/eventos/promocionar">Solicitar destacado</Link>:null}
   </div>)}
  </section>
 </div>;
}