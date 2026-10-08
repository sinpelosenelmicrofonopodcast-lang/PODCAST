import { NextResponse } from "next/server";
// Never assume that an AdSense-for-YouTube publisher ID can sell web display inventory.
// Set this variable only to a publisher ID authorized for this website in AdSense.
export const dynamic="force-dynamic";
export function GET(){
 const id=String(process.env.ADSENSE_CONTENT_PUBLISHER_ID??"").trim();
 if(!/^pub-[0-9]{16}$/.test(id))return new NextResponse("Not configured",{status:404,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
 return new NextResponse(`google.com, ${id}, DIRECT, f08c47fec0942fa0\n`,
  {headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"public, max-age=3600"}});
}
