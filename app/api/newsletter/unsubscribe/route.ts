import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime="nodejs";
export async function POST(req:NextRequest){
 const body=await req.json().catch(()=>({}));
 const token=String(body.token??"").trim();
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))
  return NextResponse.json({ok:false,error:"Enlace de baja inválido."},{status:400});
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL??"",key=process.env.SUPABASE_SERVICE_ROLE_KEY??"";
 if(!url||!key)return NextResponse.json({ok:false,error:"Servicio no disponible."},{status:503});
 const service=createClient(url,key,{auth:{persistSession:false}});
 const {data,error}=await service.from("newsletter_subscribers").update({status:"unsubscribed",unsubscribed_at:new Date().toISOString(),unsubscribe_reason:"self_service",updated_at:new Date().toISOString()})
  .eq("unsubscribe_token",token).eq("status","active").select("id");
 if(error)return NextResponse.json({ok:false,error:"Error procesando baja."},{status:500});
 // Already-unsubscribed links are idempotent, without disclosing addresses.
 return NextResponse.json({ok:true,message:"Tu solicitud de baja fue procesada."},{headers:{"Cache-Control":"no-store"}});
}