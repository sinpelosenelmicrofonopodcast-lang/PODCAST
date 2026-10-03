import {NextRequest,NextResponse} from 'next/server';
import {requireAdminApi} from '@/lib/adminAuth';
export const dynamic='force-dynamic';
async function call(request:NextRequest,action:string,data:Record<string,unknown>={}){
 const auth=await requireAdminApi(request);if(!auth.ok)return NextResponse.json({error:auth.error},{status:auth.status});
 try{const url=(process.env.NEXT_PUBLIC_SUPABASE_URL||'')+'/functions/v1/editorial-drive';const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},body:JSON.stringify({...data,action,actor:auth.userId}),cache:'no-store'});const result=await response.json();return NextResponse.json(result,{status:response.status,headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'No se pudo conectar el editorial'},{status:502});}
}
export async function GET(request:NextRequest){return call(request,'list');}
export async function POST(request:NextRequest){if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Origen no permitido'},{status:403});const p=await request.json().catch(()=>({}));if(!['save','decision','sync','pause'].includes(p.action))return NextResponse.json({error:'Acción inválida'},{status:400});return call(request,p.action,p);}
