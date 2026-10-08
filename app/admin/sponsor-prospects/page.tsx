"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
type Prospect={id:string;business_name:string;region:string;industry:string;address:string|null;public_phone:string|null;pitch_angle:string;relationship:string;priority:number;stage:string;notes:string|null;next_follow_up_at:string|null;created_at:string};
const stages:[string,string][]=[["research","Investigar"],["prioritize","Priorizar"],["contacted","Contactado"],["proposal","Propuesta"],["won","Ganado"],["declined","Descartado"]];
function toLocal(v:string|null){if(!v)return "";const d=new Date(v);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
export default function SponsorPipeline(){
 const [items,setItems]=useState<Prospect[]>([]);const [draft,setDraft]=useState<Record<string,{stage:string;notes:string;follow:string}>>({});
 const [filter,setFilter]=useState("all");const [busy,setBusy]=useState("");const [error,setError]=useState("");const [loading,setLoading]=useState(true);
 const token=async()=>(await supabase.auth.getSession()).data.session?.access_token??"";
 const load=useCallback(async()=>{
  setLoading(true);setError("");const tk=await token();
  if(!tk){setError("Inicia sesión.");setLoading(false);return;}
  const r=await fetch("/api/admin/sponsor-prospects",{headers:{Authorization:`Bearer ${tk}`},cache:"no-store"});
  const j=await r.json().catch(()=>({}));setLoading(false);
  if(!r.ok||!j.ok){setError(j.error??"Error cargando prospectos.");return;}
  const a:Prospect[]=j.items??[];setItems(a);
  setDraft(Object.fromEntries(a.map(x=>[x.id,{stage:x.stage,notes:x.notes??"",follow:toLocal(x.next_follow_up_at)}])));
 },[]);
 useEffect(()=>{void load();},[load]);
 const shown=useMemo(()=>items.filter(x=>filter==="all"||x.stage===filter),[items,filter]);
 const change=(id:string,key:"stage"|"notes"|"follow",value:string)=>setDraft(old=>({...old,[id]:{...old[id],[key]:value}}));
 const save=async(id:string)=>{
  const tk=await token();if(!tk)return setError("Sesión caducada.");
  const d=draft[id];if(!d)return;
  setBusy(id);const r=await fetch("/api/admin/sponsor-prospects",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${tk}`},
   body:JSON.stringify({id,stage:d.stage,notes:d.notes,next_follow_up_at:d.follow?new Date(d.follow).toISOString():null})});
  const j=await r.json().catch(()=>({}));setBusy("");
  if(!r.ok||!j.ok){setError(j.error??"No se pudo guardar.");return;}
  setItems(prev=>prev.map(x=>x.id===id?j.item:x));
 };
 return <div style={{display:"grid",gap:16}}>
  <header><p className="page-kicker">MONETIZACIÓN · PROSPECCIÓN</p><h1>Patrocinadores potenciales</h1>
  <p className="muted">{items.length} negocios investigados · ninguno ha sido contactado automáticamente.</p>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Link href="/media-kit" className="button secondary">Media kit</Link><button className="button" onClick={()=>void load()}>Actualizar</button></div></header>
  <label>Filtrar por estado <select className="input" style={{maxWidth:270}} value={filter} onChange={e=>setFilter(e.target.value)}>
   <option value="all">Todos ({items.length})</option>{stages.map(([v,l])=><option key={v} value={v}>{l} ({items.filter(x=>x.stage===v).length})</option>)}
  </select></label>
  {error?<p role="alert" style={{color:"var(--danger)"}}>{error}</p>:null}
  {loading?<p>Cargando negocios…</p>:shown.map(p=><article className="card" style={{padding:"clamp(16px,3vw,26px)"}} key={p.id}>
   <div style={{display:"flex",gap:16,justifyContent:"space-between",flexWrap:"wrap"}}>
    <div style={{minWidth:0,overflowWrap:"anywhere"}}><h2 style={{marginTop:0}}>{p.business_name}</h2><p className="muted">{p.industry} · {p.region} · Prioridad {p.priority}</p><p>{p.pitch_angle}</p><p className="muted">{p.relationship}</p><p className="muted">{p.address}</p></div>
    <div style={{display:"flex",alignItems:"start",gap:8,flexWrap:"wrap"}}>{p.public_phone?<a className="button secondary" href={`tel:${p.public_phone.replace(/[^+0-9]/g,"")}`}>Llamar</a>:null}<Link href="/media-kit" className="button secondary">Propuesta</Link></div>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,230px),1fr))",gap:12}}>
    <label>Etapa <select className="input" value={draft[p.id]?.stage??p.stage} onChange={e=>change(p.id,"stage",e.target.value)}>
      {stages.map(([v,l])=><option key={v} value={v}>{l}</option>)}
    </select></label>
    <label>Seguimiento <input className="input" type="datetime-local" value={draft[p.id]?.follow??""} onChange={e=>change(p.id,"follow",e.target.value)}/></label>
   </div>
   <label>Notas de contacto <textarea className="textarea" rows={3} value={draft[p.id]?.notes??""} onChange={e=>change(p.id,"notes",e.target.value)} maxLength={3000}/></label>
   <button className="button" onClick={()=>void save(p.id)} disabled={busy===p.id}>{busy===p.id?"Guardando…":"Guardar seguimiento"}</button>
  </article>)}
 </div>;
}
