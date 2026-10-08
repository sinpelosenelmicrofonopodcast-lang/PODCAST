import { NextResponse } from "next/server";
// The publisher ID matches the existing Sin Pelos AdSense for YouTube account.
// Google permits an upgrade of that same account for website inventory.
// ads.txt declares authorized inventory ownership; it does not indicate that the
// website is approved or that ads have started running.
export const dynamic = "force-dynamic";

export function GET() {
  return new NextResponse(
    "google.com, pub-4245621675541095, DIRECT, f08c47fec0942fa0\n",
    { status: 200, headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }}
  );
}
