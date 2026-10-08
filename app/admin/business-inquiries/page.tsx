"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
type Lead={id:string;inquiry_type:string;full_name:string;email:string;phone:string|null;business_name:string|null;event_date:string|null;location:string|null;budget_range:string|null;details:string;status:string;staff_notes:string|null;next_follow_up_at:string|null;created_at:string};
const stages=["new","contacted","quoted","booked","closed","lost"];
const names:Record<string,string>={new:"Nueva",contacted:"Contactado",quoted:"Cotizado",booked:"Contratado",closed:"Cerrado",lost:"No concretó"};
const local=(x:string|null)=>x?new Date(new Date(x).getTime()-new Date(x).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
export default function BusinessInquiriesAdmin(){
 const [items,setItems]=useState<Lead[]>([]),[filter,setFilter]=useState("all"),[loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[error,setError]=useState("");
 const [draft,setDraft]=useState<Record<string,{status:string;notes:string;date:string}>>({});
 const token=async()=>(await supabase.auth.getSession()).data.session?.access_token??"";
 const load=async()=>{setLoading(true);setError("");const t=await token();if(!t){setError("Inicia sesión.");setLoading(false);return;}
  const r=await fetch("/api/admin/business-inquiries",{headers:{Authorization:"Bearer "+t},cache:"no-store"});const j=await r.json().catch(()=>({}));setLoading(false);
  if(!r.ok||!j.ok){setError(j.error??"Error leyendo solicitudes.");return;}
  const a:Lead[]=j.items??[];setItems(a);setDraft(Object.fromEntries(a.map(x=>[x.id,{status:x.status,notes:x.staff_notes??"",date:local(x.next_follow_up_at)}])));
 };
 useEffect(()=>{void load();},[]);
 const update=(id:string,key:"status"|"notes"|"date",v:string)=>setDraft(old=>({...old,[id]:{...old[id],[key]:v}}));
 const save=async(id:string)=>{const t=await token(),d=draft[id];if(!t||!d)return;setBusy(id);setError("");
  const r=await fetch("/api/admin/business-inquiries",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({id,status:d.status,staff_notes:d.notes,next_follow_up_at:d.date?new Date(d.date).toISOString():null})});
  const j=await r.json().catch(()=>({}));setBusy("");if(!r.ok||!j.ok){setError(j.error??"Error guardando.");return;}
  setItems(old=>old.map(x=>x.id===id?j.item:x));
 };
 const display=items.filter(x=>filter==="all"||x.status===filter);
 return <main style={{display:"grid",gap:17}}><header><p className="page-kicker">PRIME CUT · B&B</p><h1>Solicitudes de producción y eventos</h1><p className="muted">{items.length} consultas · sin cotizaciones automáticas.</p><div style={{display:"flex",gap:9,flexWrap:"wrap"}}><Link href="/servicios" className="button secondary">Ver servicios</Link><button className="button" onClick={()=>void load()}>Recargar</button></div></header>
 <label>Filtrar <select className="select" value={filter} onChange={e=>setFilter(e.target.value)} style={{maxWidth:240}}><option value="all">Todas ({items.length})</option>{stages.map(x=><option key={x} value={x}>{names[x]} ({items.filter(v=>v.status===x).length})</option>)}</select></label>
 {error?<p role="alert">{error}</p>:null}
 {loading?<p>Cargando…</p>:display.length===0?<p className="card" style={{padding:18}}>Sin solicitudes en esta etapa.</p>:display.map(x=><article className="card" key={x.id} style={{padding:20,minWidth:0,overflowWrap:"anywhere"}}>
  <h2>{x.business_name||x.full_name}</h2><p className="muted">{x.full_name} · {x.inquiry_type} · {new Date(x.created_at).toLocaleString("es-PR")}</p>
  <p><strong>Fecha:</strong> {x.event_date||"Por definir"} · <strong>Lugar:</strong> {x.location||"Pendiente"} · <strong>Presupuesto:</strong> {x.budget_range||"Por definir"}</p><p style={{whiteSpace:"pre-wrap"}}>{x.details}</p>
  <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><a href={"mailto:"+x.email} className="button secondary">Email</a>{x.phone?<a href={"tel:"+x.phone.replace(/[^+0-9]/g,"")} className="button secondary">Llamar</a>:null}</div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,210px),1fr))",gap:10,marginTop:12}}>
   <label>Etapa<select className="select" value={draft[x.id]?.status??x.status} onChange={e=>update(x.id,"status",e.target.value)}>{stages.map(s=><option key={s} value={s}>{names[s]}</option>)}</select></label>
   <label>Seguimiento<input className="input" type="datetime-local" value={draft[x.id]?.date??""} onChange={e=>update(x.id,"date",e.target.value)}/></label>
  </div>
  <label>Notas internas<textarea className="textarea" rows={3} value={draft[x.id]?.notes??""} onChange={e=>update(x.id,"notes",e.target.value)}/></label>
  <button className="button" disabled={busy===x.id} onClick={()=>void save(x.id)}>{busy===x.id?"Guardando…":"Guardar"}</button>
 </article>)}</main>;
}