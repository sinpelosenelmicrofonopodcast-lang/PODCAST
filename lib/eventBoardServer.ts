import {createClient} from "@supabase/supabase-js";
import type {NextRequest} from "next/server";
export function serviceClient(){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL??"",key=process.env.SUPABASE_SERVICE_ROLE_KEY??"";
 if(!url||!key)throw new Error("Server database is unavailable");
 return createClient(url,key,{auth:{persistSession:false}});
}
export async function verifiedEventUser(req:NextRequest){
 const token=(req.headers.get("authorization")??"").replace(/^Bearer\s+/i,"").trim();
 if(!token)return null;
 const service=serviceClient();const {data,error}=await service.auth.getUser(token);const u=data.user;
 if(error||!u?.id||u.is_anonymous||!u.email_confirmed_at)return null;
 return {id:u.id,email:String(u.email??"").toLowerCase(),service};
}
export const plans={
 spotlight_3d:{days:3,usd:15},spotlight_7d:{days:7,usd:29},spotlight_14d:{days:14,usd:49}
} as const;
export const clean=(x:unknown,max=300)=>String(x??"").trim().slice(0,max);
export function safeUrl(x:unknown){
 const v=clean(x,500);if(!v)return null;
 try{const u=new URL(v);if(u.protocol!=="https:"||!u.hostname.includes(".")||u.username||u.password)return null;
 const h=u.hostname.toLowerCase();if(h==="localhost"||h.endsWith(".local")||h.endsWith(".internal"))return null;
 return u.toString();}catch{return null;}
}
export const eventSlug=(title:string,id:string)=>title.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,65)+"-"+id.slice(0,8);
