import { NextRequest, NextResponse } from "next/server";
import { parseMetaCommentWebhook, processSocialCommentEvent, verifyMetaWebhookSignature } from "@/lib/socialAutoReply";
import { supabaseService } from "@/lib/supabaseService";

export async function GET(request: NextRequest) {
  const mode = String(request.nextUrl.searchParams.get("hub.mode") ?? "").trim();
  const verifyToken = String(request.nextUrl.searchParams.get("hub.verify_token") ?? "").trim();
  const challenge = String(request.nextUrl.searchParams.get("hub.challenge") ?? "").trim();
  const expected = String(process.env.META_WEBHOOK_VERIFY_TOKEN ?? "").trim();

  if (mode === "subscribe" && expected && verifyToken === expected) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ ok: false, error: "Webhook verification failed." }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyMetaWebhookSignature(rawBody, signature, process.env.META_APP_SECRET)) {
    return NextResponse.json({ ok: false, error: "Invalid webhook signature." }, { status: 401 });
  }

  const payload = JSON.parse(rawBody || "{}");
  const events = parseMetaCommentWebhook(payload);
  if (events.length === 0) {
    return NextResponse.json({ ok: true, received: 0, processed: 0 });
  }

  const service = supabaseService();
  let processed = 0;
  for (const event of events) {
    try {
      await processSocialCommentEvent(service, event);
      processed += 1;
    } catch {
      // ignore individual event failures so Meta still gets 200 and retries aren't amplified
    }
  }

  return NextResponse.json({ ok: true, received: events.length, processed });
}
