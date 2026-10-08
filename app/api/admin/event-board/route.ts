import {NextRequest,NextResponse} from "next/server";
import {requireStaffApi} from "@/lib/adminAuth";
import {getRequestAuditMeta,logAdminAudit} from "@/lib/adminAudit";
import {eventSlug,plans,clean} from "@/lib/eventBoardServer";
export async function GET(req:NextRequest){
 const a=await requireStaffApi(req,"manage_events");if(!a.ok)return NextResponse.json({ok:false,error:a.error},{status:a.status});
 const [su,pr]=await Promise.all([a.service.from("community_event_submissions").select("*").order("created_at",{ascending:false}).limit(100),
 a.service.from("event_promotion_requests").select("*").order("created_at",{ascending:false}).limit(100)]);
 if(su.error||pr.error)return NextResponse.json({ok:false,error:"Error de lectura."},{status:500});
 const ids=(pr.data??[]).map((v:any)=>v.event_id);let titles:Record<string,string>={};
 if(ids.length){const r=await a.service.from("events").select("id,title").in("id",ids);titles=Object.fromEntries((r.data??[]).map((v:any)=>[v.id,v.title]));}
 return NextResponse.json({ok:true,submissions:su.data??[],promotions:(pr.data??[]).map((v:any)=>({...v,event_title:titles[v.event_id]??v.event_id}))},{headers:{"Cache-Control":"no-store"}});
}
export async function PATCH(req:NextRequest){
 const a=await requireStaffApi(req,"manage_events");if(!a.ok)return NextResponse.json({ok:false,error:a.error},{status:a.status});
 const b=await req.json().catch(()=>({})),action=clean(b.action,45),id=clean(b.id,50),note=clean(b.notes,1500),s=a.service;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({ok:false,error:"ID inválido."},{status:400});
 let message="";
 if(action==="approve"||action==="reject"){
  const {data:sub}=await s.from("community_event_submissions").select("*").eq("id",id).single();
  if(!sub||sub.review_status!=="pending")return NextResponse.json({ok:false,error:"No está pendiente."},{status:409});
  if(action==="reject"){
   const {error}=await s.from("community_event_submissions").update({review_status:"rejected",review_notes:note||"No se pudo verificar.",reviewed_by:a.userId,reviewed_at:new Date().toISOString()}).eq("id",id).eq("review_status","pending");
   if(error)return NextResponse.json({ok:false,error:"Falló rechazo."},{status:500});message="Rechazado.";
  }else{
   if(!sub.official_url||!sub.organizer_name||new Date(sub.end_datetime).getTime()<=Date.now())return NextResponse.json({ok:false,error:"Evento vencido o sin fuente."},{status:400});
   const row={submission_id:id,slug:eventSlug(sub.title,id),title:sub.title,description:sub.description,
    start_datetime:sub.start_datetime,end_datetime:sub.end_datetime,location_name:sub.location_name,address:sub.address,city:sub.city,state:sub.state,
    organizer_name:sub.organizer_name,flyer_image_url:sub.flyer_image_url,external_url:sub.official_url,source_url:sub.official_url,
    source_checked_at:new Date().toISOString(),category:sub.category,is_published:true,updated_at:new Date().toISOString()};
   const {data:ev,error}=await s.from("events").upsert(row,{onConflict:"submission_id"}).select("id").single();
   if(error||!ev)return NextResponse.json({ok:false,error:"No se pudo publicar."},{status:500});
   const {error:up}=await s.from("community_event_submissions").update({review_status:"approved",published_event_id:ev.id,reviewed_by:a.userId,reviewed_at:new Date().toISOString(),review_notes:note||null}).eq("id",id);
   if(up)return NextResponse.json({ok:false,error:"Publicado; error actualizando revisión. Recarga."},{status:500});
   message="Publicado.";
  }
 }else if(["invoice","activate","reject_promotion"].includes(action)){
  const {data:p}=await s.from("event_promotion_requests").select("*").eq("id",id).single();
  if(!p||!["requested","invoice_sent"].includes(p.status))return NextResponse.json({ok:false,error:"Promoción no pendiente."},{status:409});
  if(action==="invoice"||action==="reject_promotion"){
   const {error}=await s.from("event_promotion_requests").update({status:action==="invoice"?"invoice_sent":"rejected",admin_notes:note||null}).eq("id",id);
   if(error)return NextResponse.json({ok:false,error:"Error guardando."},{status:500});
   message=action==="invoice"?"Marcada como facturada: el sistema NO envió correo.":"Rechazada.";
  }else{
   const payment_reference=clean(b.payment_reference,150);
   if(payment_reference.length<5)return NextResponse.json({ok:false,error:"Hace falta referencia de pago verificado."},{status:400});
   const {data:ev}=await s.from("events").select("id,is_published,end_datetime,start_datetime").eq("id",p.event_id).single();
   const cutoff=new Date(ev?.end_datetime||ev?.start_datetime||0).getTime();
   if(!ev?.is_published||cutoff<=Date.now())return NextResponse.json({ok:false,error:"Evento vencido."},{status:400});
   const offer=plans[p.plan_code as keyof typeof plans];if(!offer)return NextResponse.json({ok:false,error:"Plan inválido."},{status:400});
   const end=new Date(Math.min(cutoff,Date.now()+offer.days*86400000)).toISOString();
   const {error}=await s.from("events").update({promoted_at:new Date().toISOString(),promoted_until:end,updated_at:new Date().toISOString()}).eq("id",ev.id);
   if(error)return NextResponse.json({ok:false,error:"Falló activación."},{status:500});
   const {error:pe}=await s.from("event_promotion_requests").update({status:"active",payment_reference,confirmed_by:a.userId,confirmed_at:new Date().toISOString(),active_until:end,admin_notes:note||null}).eq("id",id);
   if(pe)return NextResponse.json({ok:false,error:"Destacado activado; falta registrar pago. Revisar."},{status:500});
   message="Promoción activada con pago confirmado manualmente.";
  }
 }else return NextResponse.json({ok:false,error:"Acción no permitida."},{status:400});
 await logAdminAudit(s,{actorId:a.userId,action:"admin.event_board."+action,targetId:id,meta:{note:note.slice(0,100)},...getRequestAuditMeta(req)});
 return NextResponse.json({ok:true,message});
}