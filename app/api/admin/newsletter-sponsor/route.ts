import { NextRequest, NextResponse } from "next/server";
import { requireStaffApi } from "@/lib/adminAuth";
export async function GET(req:NextRequest){
 const auth=await requireStaffApi(req,"manage_newsletter");
 if(!auth.ok)return NextResponse.json({ok:false,error:auth.error},{status:auth.status});
 const [temp,campaign,subscribers]=await Promise.all([
  auth.service.from("newsletter_templates").select("template_key,subject_template,preheader_template,html_template,text_template,is_active").eq("template_key","sponsor_digest_launch_v1").maybeSingle(),
  auth.service.from("newsletter_campaigns").select("campaign_key,subject,preview_text,status,created_at").eq("campaign_key","sponsor-launch-draft-20261008").maybeSingle(),
  auth.service.from("newsletter_subscribers").select("id",{count:"exact",head:true}).eq("status","active")
 ]);
 if(temp.error||campaign.error||subscribers.error)return NextResponse.json({ok:false,error:"No se pudo leer el borrador."},{status:500});
 return NextResponse.json({ok:true,template:temp.data,campaign:campaign.data,subscribers:subscribers.count??0},{headers:{"Cache-Control":"no-store"}});
}
