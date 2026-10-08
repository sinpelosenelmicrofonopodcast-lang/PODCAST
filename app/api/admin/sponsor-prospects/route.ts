import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
const columns="id,business_name,region,industry,address,public_phone,pitch_angle,relationship,stage,priority,notes,next_follow_up_at,created_at";
const valid=new Set(["research","prioritize","contacted","proposal","won","declined"]);
export async function GET(request:NextRequest) {
 const auth=await requireStaffApi(request,"manage_promotions");
 if(!auth.ok) return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
 const {data,error}=await auth.service.from("sponsor_prospects").select(columns).order("priority",{ascending:true}).order("business_name",{ascending:true}).limit(250);
 if(error) return NextResponse.json({ok:false,error:"No se pudo consultar el pipeline."},{status:500});
 return NextResponse.json({ok:true,items:data??[]},{headers:{"Cache-Control":"no-store"}});
}
export async function PATCH(request:NextRequest) {
 const auth=await requireStaffApi(request,"manage_promotions");
 if(!auth.ok) return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
 const body=await request.json().catch(()=>({}));
 const id=String(body.id??"");const stage=String(body.stage??"");
 if(!/^[0-9a-f-]{36}$/i.test(id)||!valid.has(stage)) return NextResponse.json({ok:false,error:"Solicitud no válida"},{status:400});
 const raw=body.next_follow_up_at?new Date(String(body.next_follow_up_at)):null;
 if(raw&&!Number.isFinite(raw.getTime())) return NextResponse.json({ok:false,error:"Fecha inválida"},{status:400});
 const changes={stage,notes:String(body.notes??"").trim().slice(0,3000)||null,next_follow_up_at:raw?.toISOString()??null,updated_at:new Date().toISOString()};
 const {data,error}=await auth.service.from("sponsor_prospects").update(changes).eq("id",id).select(columns).single();
 if(error) return NextResponse.json({ok:false,error:"No se pudo actualizar."},{status:500});
 await logAdminAudit(auth.service,{actorId:auth.userId,action:"admin.sponsor_prospects.update",targetTable:"sponsor_prospects",targetId:id,meta:{stage},...getRequestAuditMeta(request)});
 return NextResponse.json({ok:true,item:data});
}
