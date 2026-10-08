"use client";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabaseClient";
type S={id:string;title:string;description:string;official_url:string;city:string;organizer_name:string;start_datetime:string;review_status:string};
type P={id:string;event_title:string;plan_code:string;price_usd:number;buyer_email:string;status:string};
export default function ModerateEvents(){
 const [subs,setSubs]=useState<S[]>([]),[promos,setPromos]=useState<P[]>([]),[msg,setMsg]=useState(""),[busy,setBusy]=useState(""),[notes,setNotes]=useState<Record<string,string>>({}),[refs,setRefs]=useState<Record<string,string>>({});
 const token=async()=>(await supabase.auth.getSession()).data.session?.access_token??"";
 const load=async()=>{const t=await token();if(!t)return setMsg("Inicia sesión como administrador.");
  const r=await fetch("/api/admin/event-board",{headers:{Authorization:"Bearer "+t},cache:"no-store"});const j=await r.json().catch(()=>({}));
  if(!r.ok)return setMsg(j.error||"Error");setSubs(j.submissions??[]);setPromos(j.promotions??[]);
 };
 useEffect(()=>{void load();},[]);
 const act=async(action:string,id:string)=>{
  const t=await token();setBusy(id);setMsg("");
  const r=await fetch("/api/admin/event-board",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},
   body:JSON.stringify({action,id,notes:notes[id]||"",payment_reference:refs[id]||""})});
  const j=await r.json().catch(()=>({}));setBusy("");setMsg(j.message||j.error||"Error");if(r.ok)void load();
 };
 const pend=subs.filter(x=>x.review_status==="pending"),ps=promos.filter(x=>["requested","invoice_sent"].includes(x.status));
 return <main style={{display:"grid",gap:20}}><header><p className="page-kicker">AGENDA · MODERACIÓN</p><h1>Revisión y promociones</h1><p>{pend.length} eventos pendientes · {ps.length} promociones por tramitar</p><button className="button secondary" onClick={()=>void load()}>Actualizar</button></header>
 {msg?<p role="status">{msg}</p>:null}
 <section><h2>Eventos enviados por usuarios</h2>{pend.length===0?<p className="card" style={{padding:18}}>Sin propuestas pendientes.</p>:pend.map(x=><article className="card" key={x.id} style={{padding:20,marginBottom:12}}>
  <h3>{x.title}</h3><p>{x.description}</p><p>{x.city} · {x.organizer_name} · {new Date(x.start_datetime).toLocaleString("es-US",{timeZone:"America/Chicago"})}</p>
  <p><a className="button secondary" href={x.official_url} target="_blank" rel="noreferrer">Verificar fuente</a></p>
  <label>Notas<textarea className="textarea" rows={2} value={notes[x.id]||""} onChange={e=>setNotes(v=>({...v,[x.id]:e.target.value}))}/></label>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="button" disabled={busy===x.id} onClick={()=>void act("approve",x.id)}>Aprobar</button><button className="button secondary" disabled={busy===x.id} onClick={()=>void act("reject",x.id)}>Rechazar</button></div>
 </article>)}</section>
 <section><h2>Destacados por cobrar</h2><p className="muted">El pago se verifica fuera de la página. Marcar «factura enviada» NO envía correos automáticamente.</p>
 {ps.length===0?<p className="card" style={{padding:18}}>Sin solicitudes pendientes.</p>:ps.map(x=><article className="card" key={x.id} style={{padding:20,marginBottom:12}}>
  <h3>{x.event_title}</h3><p>{x.plan_code} · {"$"}{x.price_usd} USD · {x.status} · {x.buyer_email}</p>
  <label>Referencia de pago confirmado<input className="input" value={refs[x.id]||""} onChange={e=>setRefs(v=>({...v,[x.id]:e.target.value}))}/></label>
  <label>Notas<textarea className="textarea" rows={2} value={notes[x.id]||""} onChange={e=>setNotes(v=>({...v,[x.id]:e.target.value}))}/></label>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button className="button secondary" disabled={busy===x.id} onClick={()=>void act("invoice",x.id)}>Factura enviada</button>
  <button className="button" disabled={busy===x.id||(refs[x.id]||"").length<5} onClick={()=>void act("activate",x.id)}>Pago verificado · Activar</button>
  <button className="button secondary" disabled={busy===x.id} onClick={()=>void act("reject_promotion",x.id)}>Rechazar</button></div>
 </article>)}</section></main>;
}