"use client";
import {useEffect,useState} from "react";
type Bio={slug:string;title:string;intro:string;biography:string;photo_url:string};
export default function BiografiasAdmin(){
const [bios,setBios]=useState<Bio[]>([]),[active,setActive]=useState("bito"),[status,setStatus]=useState("Cargando biografías..."),[saving,setSaving]=useState(false);
useEffect(()=>{fetch("/api/admin/biografias",{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"No se pudo cargar");setBios(j.bios);setStatus("");}).catch(e=>setStatus(e.message));},[]);
const current=bios.find(x=>x.slug===active);
const update=(field:keyof Bio,value:string)=>setBios(xs=>xs.map(x=>x.slug===active?{...x,[field]:value}:x));
const save=async()=>{if(!current)return;setSaving(true);setStatus("");try{const r=await fetch("/api/admin/biografias",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(current)});const j=await r.json();if(!r.ok)throw Error(j.error||"Error al guardar");setStatus("Biografía guardada y disponible en la página pública.");}catch(e){setStatus(e instanceof Error?e.message:"Error");}finally{setSaving(false);}};
return <section><h1 className="section-title">Biografías · Bebo y Bito</h1><p className="muted">Edita la sección Conócenos sin volver a desplegar el sitio.</p>
<div style={{display:"flex",gap:12,margin:"20px 0"}}>{["bito","bebo"].map(x=><button key={x} className="button secondary" type="button" onClick={()=>{setActive(x);setStatus("");}} style={{opacity:active===x?1:.55}}>{x==="bito"?"Bito":"Bebo"}</button>)}</div>
{current?<div className="card form-stack" style={{maxWidth:850}}>
<label>Título<input className="input" value={current.title} onChange={e=>update("title",e.target.value)}/></label>
<label>Introducción<textarea className="textarea" rows={5} value={current.intro} onChange={e=>update("intro",e.target.value)}/></label>
<label>Biografía completa<textarea className="textarea" rows={17} value={current.biography} onChange={e=>update("biography",e.target.value)}/></label>
<label>Ruta de foto (imagen del sitio)<input className="input" value={current.photo_url} onChange={e=>update("photo_url",e.target.value)}/></label>
<div><button type="button" className="button" disabled={saving} onClick={save}>{saving?"Guardando...":"Guardar y publicar"}</button> <a className="button secondary" href={"/acerca#"+active} target="_blank" rel="noreferrer">Ver en la web</a></div></div>:null}
{status?<p role="status" className="muted">{status}</p>:null}</section>;
}
