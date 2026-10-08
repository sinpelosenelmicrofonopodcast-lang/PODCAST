import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export const runtime = "nodejs";
const allowed = new Set(["video","photo_video","interviews","podcast_production","event_coverage","equipment_rental","event_listing","other"]);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function clean(v:unknown,max:number){return String(v??"").trim().slice(0,max);}
export async function POST(request:NextRequest){
 try {
  const body=await request.json().catch(()=>null);
  if(!body || typeof body!=="object")return NextResponse.json({ok:false,error:"Solicitud inválida."},{status:400});
  if(clean(body.company_fax,100))return NextResponse.json({ok:true});
  const inquiry_type=clean(body.inquiry_type,30),full_name=clean(body.full_name,120),email=clean(body.email,254).toLowerCase(),details=clean(body.details,4000),rawDate=clean(body.event_date,10);
  if(!allowed.has(inquiry_type)||full_name.length<2||!emailPattern.test(email)||details.length<10)
   return NextResponse.json({ok:false,error:"Revisa nombre, correo, servicio y descripción (mínimo 10 caracteres)."},{status:400});
  if(rawDate && (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)||!Number.isFinite(Date.parse(rawDate+"T12:00:00Z"))))
   return NextResponse.json({ok:false,error:"Fecha inválida."},{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL??"",key=process.env.SUPABASE_SERVICE_ROLE_KEY??"";
  if(!url||!key)return NextResponse.json({ok:false,error:"Servicio temporalmente no disponible."},{status:503});
  const service=createClient(url,key,{auth:{persistSession:false}});
  const cutoff=new Date(Date.now()-10*60_000).toISOString();
  const {data:recent,error:checkError}=await service.from("business_inquiries").select("id").eq("email",email).eq("inquiry_type",inquiry_type).gte("created_at",cutoff).limit(1);
  if(checkError)return NextResponse.json({ok:false,error:"No se pudo procesar. Intenta luego."},{status:503});
  if(recent?.length)return NextResponse.json({ok:true,message:"Ya recibimos una solicitud reciente con ese correo."},{status:202});
  const payload={inquiry_type,full_name,email,phone:clean(body.phone,35)||null,business_name:clean(body.business_name,140)||null,event_date:rawDate||null,
   location:clean(body.location,160)||null,budget_range:clean(body.budget_range,70)||null,details,source_path:clean(body.source_path,160)||"/servicios",utm_source:clean(body.utm_source,90)||null};
  const {error}=await service.from("business_inquiries").insert(payload);
  if(error)return NextResponse.json({ok:false,error:"No se pudo guardar la solicitud."},{status:500});
  return NextResponse.json({ok:true,message:"Solicitud recibida. Te contactaremos para revisar los detalles; aún no es una reservación confirmada."},{status:201});
 }catch{return NextResponse.json({ok:false,error:"No se pudo procesar tu solicitud."},{status:500});}
}