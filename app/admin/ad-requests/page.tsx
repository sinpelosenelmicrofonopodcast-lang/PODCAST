"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
type Lead = {id:string;full_name:string;email:string;phone:string|null;company:string;budget:string|null;
  message:string;status:string;created_at:string;lead_source:string|null;utm_campaign:string|null;
  internal_notes:string|null;next_follow_up_at:string|null;};
const states:[string,string][]=[["new","Nuevo"],["contacted","Contactado"],["proposal","Propuesta"],["won","Ganado"],["lost","Perdido"],["closed","Cerrado"]];
function localDate(v:string|null){if(!v)return "";const d=new Date(v);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export default function LeadAdmin() {
  const [items,setItems]=useState<Lead[]>([]);
  const [filter,setFilter]=useState("all"); const [error,setError]=useState("");
  const [loading,setLoading]=useState(true); const [busy,setBusy]=useState("");
  const [draft,setDraft]=useState<Record<string,{status:string;notes:string;date:string}>>({});
  const getToken=async()=>(await supabase.auth.getSession()).data.session?.access_token??"";
  const load=useCallback(async()=>{
    setLoading(true);setError("");
    const t=await getToken();
    if(!t){setError("Inicia sesión como administrador.");setLoading(false);return;}
    const r=await fetch("/api/admin/ad-requests",{headers:{Authorization:`Bearer ${t}`},cache:"no-store"});
    const j=await r.json().catch(()=>({}));
    if(!r.ok||!j.ok){setError(j.error??"Error cargando solicitudes.");setLoading(false);return;}
    const a:Lead[]=j.items??[];setItems(a);
    setDraft(Object.fromEntries(a.map(l=>[l.id,{status:l.status,notes:l.internal_notes??"",date:localDate(l.next_follow_up_at)}])));
    setLoading(false);
  },[]);
  useEffect(()=>{void load()},[load]);
  const change=(id:string,k:"status"|"notes"|"date",v:string)=>setDraft(d=>({...d,[id]:{...d[id],[k]:v}}));
  const save=async(id:string)=>{
    const t=await getToken();const d=draft[id];if(!t||!d)return;
    setBusy(id);setError("");
    const r=await fetch("/api/admin/ad-requests",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${t}`},
      body:JSON.stringify({id,status:d.status,internal_notes:d.notes,next_follow_up_at:d.date?new Date(d.date).toISOString():null})});
    const j=await r.json().catch(()=>({}));setBusy("");
    if(!r.ok||!j.ok){setError(j.error??"No se guardó.");return;}
    setItems(old=>old.map(l=>l.id===id?j.item:l));
  };
  const shown=items.filter(l=>filter==="all"||l.status===filter);
  const due=items.filter(l=>l.next_follow_up_at&&new Date(l.next_follow_up_at).getTime()<=Date.now()&&!["won","lost","closed"].includes(l.status)).length;
  return <div style={{display:"grid",gap:16}}>
    <header><p className="page-kicker">VENTAS · PATROCINIOS</p><h1>Leads comerciales</h1>
      <p className="muted">{items.length} solicitudes · {due} seguimientos vencidos</p>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><Link href="/media-kit" className="button secondary">Media kit</Link>
      <button className="button" onClick={()=>void load()}>Actualizar</button></div>
    </header>
    <label>Etapa <select className="input" style={{maxWidth:300}} value={filter} onChange={e=>setFilter(e.target.value)}>
      <option value="all">Todas ({items.length})</option>{states.map(([s,n])=><option key={s} value={s}>{n} ({items.filter(l=>l.status===s).length})</option>)}
    </select></label>
    {error?<p role="alert" style={{color:"var(--danger)"}}>{error}</p>:null}
    {loading?<p>Cargando…</p>:shown.length===0?<p className="card" style={{padding:18}}>No hay solicitudes en esta etapa.</p>:shown.map(l=>
      <article className="card" key={l.id} style={{padding:20,minWidth:0,overflowWrap:"anywhere"}}>
        <h2>{l.company}</h2><p className="muted">{l.full_name} · {new Date(l.created_at).toLocaleString("es-PR")} · {l.lead_source??"web"}</p>
        {l.budget?<p>Presupuesto: {l.budget}</p>:null}<p style={{whiteSpace:"pre-wrap"}}>{l.message}</p>
        <p><a className="button secondary" href={`mailto:${l.email}`}>Enviar email</a> {l.phone?<a className="button secondary" href={`tel:${l.phone.replace(/[^+0-9]/g,"")}`}>Llamar</a>:null}</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,220px),1fr))",gap:12}}>
          <label>Estado<select className="input" value={draft[l.id]?.status??l.status} onChange={e=>change(l.id,"status",e.target.value)}>
            {states.map(([s,n])=><option key={s} value={s}>{n}</option>)}
          </select></label>
          <label>Próximo seguimiento<input className="input" type="datetime-local" value={draft[l.id]?.date??""} onChange={e=>change(l.id,"date",e.target.value)}/></label>
        </div>
        <label>Notas internas<textarea className="textarea" rows={3} maxLength={3000} value={draft[l.id]?.notes??""} onChange={e=>change(l.id,"notes",e.target.value)}/></label>
        <button className="button" disabled={busy===l.id} onClick={()=>void save(l.id)}>{busy===l.id?"Guardando…":"Guardar seguimiento"}</button>
      </article>)}
  </div>;
}
