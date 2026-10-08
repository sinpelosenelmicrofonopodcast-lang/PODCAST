import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta,logAdminAudit } from "@/lib/adminAudit";
const columns="id,inquiry_type,full_name,email,phone,business_name,event_date,location,budget_range,details,source_path,utm_source,status,staff_notes,next_follow_up_at,created_at";
const statuses=new Set(["new","contacted","quoted","booked","closed","lost"]);
export async function GET(req:NextRequest){
 const auth=await requireStaffApi(req,"manage_promotions");
 if(!auth.ok)return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
 const {data,error}=await auth.service.from("business_inquiries").select(columns).order("created_at",{ascending:false}).limit(300);
 return error?NextResponse.json({ok:false,error:"No se pudo leer el pipeline."},{status:500}):NextResponse.json({ok:true,items:data??[]},{headers:{"Cache-Control":"no-store"}});
}
export async function PATCH(req:NextRequest){
 const auth=await requireStaffApi(req,"manage_promotions");
 if(!auth.ok)return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
 const b=await req.json().catch(()=>({}));const id=String(b.id??""),status=String(b.status??"");
 if(!/^[0-9a-f-]{36}$/i.test(id)||!statuses.has(status))return NextResponse.json({ok:false,error:"Solicitud inválida."},{status:400});
 const date=b.next_follow_up_at?new Date(String(b.next_follow_up_at)):null;
 if(date&&!Number.isFinite(date.getTime()))return NextResponse.json({ok:false,error:"Fecha inválida."},{status:400});
 const {data,error}=await auth.service.from("business_inquiries").update({status,staff_notes:String(b.staff_notes??"").slice(0,3000)||null,next_follow_up_at:date?.toISOString()??null,updated_at:new Date().toISOString()}).eq("id",id).select(columns).single();
 if(error)return NextResponse.json({ok:false,error:"No se pudo actualizar."},{status:500});
 await logAdminAudit(auth.service,{actorId:auth.userId,action:"business_inquiries.update",targetTable:"business_inquiries",targetId:id,meta:{status},...getRequestAuditMeta(req)});
 return NextResponse.json({ok:true,item:data});
}