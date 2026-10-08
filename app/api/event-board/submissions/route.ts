import {NextRequest,NextResponse} from "next/server";
import {verifiedEventUser,clean,safeUrl} from "@/lib/eventBoardServer";
export const runtime="nodejs";
const categories=new Set(["comunidad","musica","negocios","familia","deportes","cultura","otros"]);
export async function GET(req:NextRequest){
 const u=await verifiedEventUser(req);if(!u)return NextResponse.json({ok:false,error:"Inicia sesión con correo confirmado."},{status:401});
 const {data,error}=await u.service.from("community_event_submissions").select("id,title,review_status,review_notes,created_at,published_event_id,start_datetime")
  .eq("submitter_id",u.id).order("created_at",{ascending:false}).limit(50);
 return error?NextResponse.json({ok:false,error:"No se pudieron cargar tus eventos."},{status:500}):NextResponse.json({ok:true,items:data??[]},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest){
 try{
 const u=await verifiedEventUser(req);if(!u)return NextResponse.json({ok:false,error:"Necesitas cuenta y correo confirmado."},{status:401});
 const b=await req.json().catch(()=>null);if(!b||typeof b!=="object")return NextResponse.json({ok:false,error:"Datos inválidos."},{status:400});
 const title=clean(b.title,180),description=clean(b.description,5000),category=clean(b.category,25),
   city=clean(b.city,90),state=clean(b.state,4).toUpperCase()||"TX",location_name=clean(b.location_name,160),
   organizer_name=clean(b.organizer_name,150),organizer_email=clean(b.organizer_email,254).toLowerCase(),
   official_url=safeUrl(b.official_url),flyer_image_url=b.flyer_image_url?safeUrl(b.flyer_image_url):null;
 const start=new Date(String(b.start_datetime??"")),end=new Date(String(b.end_datetime??""));
 const times=Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())&&start.getTime()>Date.now()-300000&&end>start&&
  end.getTime()-start.getTime()<=31*86400000&&start.getTime()<Date.now()+2*365*86400000;
 if(title.length<6||description.length<30||!categories.has(category)||!times||!location_name||!city||!["TX","PR"].includes(state)
  ||organizer_name.length<3||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organizer_email)||!official_url||(b.flyer_image_url&&!flyer_image_url))
   return NextResponse.json({ok:false,error:"Completa fechas futuras, lugar, descripción, organizador y un enlace oficial HTTPS válido."},{status:400});
 const since=new Date(Date.now()-86400000).toISOString();
 const {count,error:countErr}=await u.service.from("community_event_submissions").select("id",{count:"exact",head:true})
  .eq("submitter_id",u.id).gte("created_at",since);
 if(countErr)return NextResponse.json({ok:false,error:"No se pudo validar la solicitud."},{status:500});
 if((count??0)>=3)return NextResponse.json({ok:false,error:"Máximo tres propuestas cada 24 horas."},{status:429});
 const {data:dup}=await u.service.from("community_event_submissions").select("id").eq("submitter_id",u.id).eq("official_url",official_url)
 .eq("start_datetime",start.toISOString()).limit(1);
 if(dup?.length)return NextResponse.json({ok:false,error:"Evento ya enviado."},{status:409});
 const {error}=await u.service.from("community_event_submissions").insert({
  submitter_id:u.id,title,description,category,start_datetime:start.toISOString(),end_datetime:end.toISOString(),location_name,
  city,state,address:clean(b.address,240)||null,organizer_name,organizer_email,organizer_phone:clean(b.organizer_phone,40)||null,
  official_url,flyer_image_url,evidence_notes:clean(b.evidence_notes,1200)||null
 });
 if(error)return NextResponse.json({ok:false,error:"No se pudo guardar el evento."},{status:500});
 return NextResponse.json({ok:true,message:"Evento enviado a revisión. Aparecerá públicamente solo tras aprobación."},{status:201});
 }catch{return NextResponse.json({ok:false,error:"Error procesando evento."},{status:500});}
}