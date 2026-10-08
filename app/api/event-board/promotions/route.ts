import {NextRequest,NextResponse} from "next/server";
import {verifiedEventUser,plans} from "@/lib/eventBoardServer";
export const runtime="nodejs";
export async function GET(req:NextRequest){
 const u=await verifiedEventUser(req);if(!u)return NextResponse.json({ok:false,error:"Sesión requerida."},{status:401});
 const {data,error}=await u.service.from("event_promotion_requests").select("id,event_id,plan_code,price_usd,status,active_until,created_at")
  .eq("requested_by",u.id).order("created_at",{ascending:false}).limit(40);
 return error?NextResponse.json({ok:false,error:"No se pudieron consultar promociones."},{status:500}):NextResponse.json({ok:true,items:data??[]});
}
export async function POST(req:NextRequest){
 try{
 const u=await verifiedEventUser(req);if(!u)return NextResponse.json({ok:false,error:"Sesión requerida."},{status:401});
 const b=await req.json().catch(()=>({})),eventId=String(b.event_id??""),plan=String(b.plan_code??"");
 if(!/^[0-9a-f-]{36}$/i.test(eventId)||!(plan in plans))return NextResponse.json({ok:false,error:"Elige tu evento y plan."},{status:400});
 const {data:submission}=await u.service.from("community_event_submissions").select("id")
  .eq("submitter_id",u.id).eq("published_event_id",eventId).eq("review_status","approved").maybeSingle();
 if(!submission)return NextResponse.json({ok:false,error:"Solo puedes destacar eventos tuyos aprobados."},{status:403});
 const {data:event}=await u.service.from("events").select("is_published,end_datetime,start_datetime").eq("id",eventId).maybeSingle();
 if(!event?.is_published||new Date(event.end_datetime||event.start_datetime).getTime()<=Date.now())
  return NextResponse.json({ok:false,error:"Evento vencido o no aprobado."},{status:400});
 const {data:existing}=await u.service.from("event_promotion_requests").select("id").eq("event_id",eventId)
  .in("status",["requested","invoice_sent","active"]).limit(1);
 if(existing?.length)return NextResponse.json({ok:false,error:"Ya hay una solicitud o un destacado activo."},{status:409});
 const price=plans[plan as keyof typeof plans].usd;
 const {error}=await u.service.from("event_promotion_requests").insert({event_id:eventId,requested_by:u.id,plan_code:plan,price_usd:price,buyer_email:u.email});
 if(error)return NextResponse.json({ok:false,error:"No se pudo registrar solicitud."},{status:500});
 return NextResponse.json({ok:true,message:"Solicitud registrada. Coordinaremos el pago y el destacado solo se activará cuando sea confirmado."},{status:201});
 }catch{return NextResponse.json({ok:false,error:"No se pudo procesar."},{status:500});}
}