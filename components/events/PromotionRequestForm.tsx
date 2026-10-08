"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {supabase} from "@/lib/supabaseClient";
type S={id:string;title:string;review_status:string;published_event_id:string|null};
export function PromotionRequestForm(){
 const [items,setItems]=useState<S[]>([]),[state,setState]=useState("loading"),[selected,setSelected]=useState(""),[plan,setPlan]=useState("spotlight_7d"),[busy,setBusy]=useState(false),[msg,setMsg]=useState(""),[error,setError]=useState("");
 useEffect(()=>{(async()=>{const t=(await supabase.auth.getSession()).data.session?.access_token;
  if(!t)return setState("guest");
  const r=await fetch("/api/event-board/submissions",{headers:{Authorization:"Bearer "+t}});if(!r.ok)return setState("guest");
  const j=await r.json();setItems((j.items??[]).filter((x:S)=>x.review_status==="approved"&&x.published_event_id));setState("ready");})();},[]);
 const submit=async()=>{setBusy(true);setError("");setMsg("");
  try{const t=(await supabase.auth.getSession()).data.session?.access_token;
   const r=await fetch("/api/event-board/promotions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({event_id:selected,plan_code:plan})});
   const j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||"Error.");setMsg(j.message);
  }catch(e){setError(e instanceof Error?e.message:"Error");}finally{setBusy(false);}
 };
 if(state==="loading")return <p>Cargando eventos…</p>;
 if(state==="guest")return <p>Inicia sesión con tu cuenta confirmada. <Link href="/login?next=%2Feventos%2Fpromocionar">Entrar</Link></p>;
 if(items.length===0)return <p>Antes de promover, publica un evento y espera aprobación. <Link href="/eventos/proponer">Enviar gratis</Link></p>;
 return <div className="card" style={{padding:24,display:"grid",gap:14}}>
  <h2>Solicita tu destacado</h2>
  <label>Evento aprobado<select className="select" value={selected} onChange={e=>setSelected(e.target.value)}>
   <option value="">Selecciona evento</option>{items.map(e=><option key={e.id} value={e.published_event_id??""}>{e.title}</option>)}</select></label>
  <label>Plan<select className="select" value={plan} onChange={e=>setPlan(e.target.value)}>
   <option value="spotlight_3d">3 días · $15</option><option value="spotlight_7d">7 días · $29</option><option value="spotlight_14d">14 días · $49</option></select></label>
  <p className="muted">No se cobra automáticamente. Tras solicitar, recibirás instrucciones de factura. El destacado solo se activa cuando un administrador confirma el pago. Durará como máximo hasta que termine el evento.</p>
  {msg?<p role="status">{msg}</p>:null}{error?<p role="alert">{error}</p>:null}
  <button className="button" onClick={submit} disabled={!selected||busy}>{busy?"Enviando…":"SOLICITAR PROMOCIÓN"}</button>
 </div>;
}