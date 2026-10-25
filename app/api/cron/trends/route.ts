import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/jobs/cronAuth";
// Retired by the Google migration. Keep the authenticated endpoint fail-closed
// so an old external scheduler cannot revive Supabase jobs or duplicate posts.
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({error:"Unauthorized cron call."},{status:401});
  return NextResponse.json({backend:"google_workspace",retired:true,error:"This legacy scheduler was retired. Use the private Google publisher and Sin Pelos Social Manager."},{status:410});
}
export const GET=POST;
