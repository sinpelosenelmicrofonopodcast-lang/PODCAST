import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
import { getRequestAuditMeta, logAdminAudit } from "@/lib/adminAudit";
const columns = "id,full_name,email,phone,company,website,budget,message,status,created_at,lead_source,utm_campaign,internal_notes,next_follow_up_at";
const statuses = new Set(["new","contacted","proposal","won","lost","closed"]);
export async function GET(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_promotions");
  if (!auth.ok) return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
  const {data,error} = await auth.service.from("ad_requests").select(columns).order("created_at",{ascending:false}).limit(300);
  if (error) return NextResponse.json({ok:false,error:"No se pudieron leer solicitudes."},{status:500});
  return NextResponse.json({ok:true,items:data??[]},{headers:{"Cache-Control":"no-store"}});
}
export async function PATCH(request: NextRequest) {
  const auth = await requireStaffApi(request, "manage_promotions");
  if (!auth.ok) return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
  const body = await request.json().catch(()=>({}));
  const id=String(body.id??""); const status=String(body.status??"");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !statuses.has(status))
    return NextResponse.json({ok:false,error:"ID o estado inválido"},{status:400});
  const next=body.next_follow_up_at ? new Date(String(body.next_follow_up_at)) : null;
  if (next && !Number.isFinite(next.getTime())) return NextResponse.json({ok:false,error:"Fecha inválida"},{status:400});
  const {data,error}=await auth.service.from("ad_requests").update({
    status,internal_notes:String(body.internal_notes??"").slice(0,3000)||null,
    next_follow_up_at:next?.toISOString()??null,updated_at:new Date().toISOString()
  }).eq("id",id).select(columns).single();
  if(error) return NextResponse.json({ok:false,error:"No se pudo guardar el seguimiento."},{status:500});
  await logAdminAudit(auth.service,{actorId:auth.userId,action:"admin.ad_requests.update",
    targetTable:"ad_requests",targetId:id,meta:{status},...getRequestAuditMeta(request)});
  return NextResponse.json({ok:true,item:data});
}
