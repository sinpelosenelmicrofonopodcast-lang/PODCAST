import { NextResponse } from "next/server";
import { PODCAST_RSS_URL } from "@/lib/podcastRss";

export function GET() {
  return NextResponse.redirect(PODCAST_RSS_URL, 307);
}

