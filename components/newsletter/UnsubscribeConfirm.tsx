"use client";
import { useState } from "react";
export function UnsubscribeConfirm({token}:{token:string}){
 const [state,setState]=useState<"idle"|"loading"|"done"|"error">("idle"),[error,setError]=useState("");
 const submit=async()=>{
  setState("loading");
  try{const r=await fetch("/api/newsletter/unsubscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});
   const j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error||"Error procesando baja.");
   setState("done");
  }catch(e){setError(e instanceof Error?e.message:"Error");setState("error");}
 };
 if(!/^[0-9a-f-]{36}$/i.test(token))return <p>El enlace de baja es inválido. Revisa el enlace de tu correo.</p>;
 if(state==="done")return <p role="status">Tu solicitud de baja fue procesada. No recibirás nuevos envíos a la dirección asociada a este enlace.</p>;
 return <div style={{display:"grid",gap:13}}><p>Si ya no deseas recibir correos de Sin Pelos, confirma la baja. No necesitas iniciar sesión.</p>
  {state==="error"?<p role="alert">{error}</p>:null}
  <button className="button" onClick={submit} disabled={state==="loading"}>{state==="loading"?"Procesando…":"CONFIRMAR BAJA DEL NEWSLETTER"}</button></div>;
}