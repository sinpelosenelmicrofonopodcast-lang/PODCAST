import {NextRequest,NextResponse} from "next/server";
import {requireAdminApi} from "@/lib/adminAuth";
export async function GET(request:NextRequest){
 const access=await requireAdminApi(request);if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
 const {data,error}=await access.service.from("host_biographies").select("slug,title,intro,biography,photo_url").order("slug");
 if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({bios:data??[]});
}
export async function PUT(request:NextRequest){
 const access=await requireAdminApi(request);if(!access.ok)return NextResponse.json({error:access.error},{status:access.status});
 const raw=await request.json().catch(()=>null);if(!raw||!["bito","bebo"].includes(raw.slug))return NextResponse.json({error:"Biografía inválida"},{status:400});
 const fields=["title","intro","biography","photo_url"] as const;
 for(const key of fields){if(typeof raw[key]!=="string"||raw[key].length>30000)return NextResponse.json({error:"Campo inválido: "+key},{status:400});}
 const localPhoto=/^\/images\/hosts\/[a-z0-9-]+\.(webp|png|jpg|jpeg)$/i.test(raw.photo_url);
 const supabasePhoto=/^https:\/\/bhuophwyhgnqhbstinqw\.supabase\.co\/storage\/v1\/object\/public\/[a-z0-9._-]+\/.+/i.test(raw.photo_url);
 if(!localPhoto&&!supabasePhoto)return NextResponse.json({error:"Usa una imagen de /images/hosts/ o una URL pública de Supabase de Sin Pelos."},{status:400});
 const {error}=await access.service.from("host_biographies").update(Object.fromEntries([...fields.map(k=>[k,raw[k]]),["updated_at",new Date().toISOString()]])).eq("slug",raw.slug).select("slug").single();
 if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ok:true});
}
