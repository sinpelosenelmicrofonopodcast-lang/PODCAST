import { NextRequest, NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabaseService";
import { getUserIdFromBearer } from "@/lib/authToken";
import { checkRateLimit } from "@/lib/validations/rateLimit";
import { asNumber, asString, isUuid } from "@/lib/validations/common";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const limited = checkRateLimit(`api:comments:vote:${ip}`, 20, 60_000);
    if (!limited.ok) {
      return NextResponse.json({ ok: false, error: "Demasiadas acciones. Intenta luego." }, { status: 429 });
    }

    const userId = await getUserIdFromBearer(request.headers.get("authorization"));
    if (!userId) return NextResponse.json({ ok: false, error: "Debes iniciar sesión para votar." }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const commentId = asString(body?.commentId, 80);
    const vote = asNumber(body?.vote, 0);
    if (!isUuid(commentId)) return NextResponse.json({ ok: false, error: "commentId inválido." }, { status: 400 });
    if (![1, -1].includes(vote)) return NextResponse.json({ ok: false, error: "vote inválido." }, { status: 400 });

    const service = supabaseService();

    const upsert = await service.from("article_comment_votes").upsert(
      {
        comment_id: commentId,
        user_id: userId,
        vote
      },
      { onConflict: "comment_id,user_id" }
    );
    if (upsert.error) return NextResponse.json({ ok: false, error: upsert.error.message }, { status: 400 });

    const votes = await service.from("article_comment_votes").select("vote").eq("comment_id", commentId);
    if (votes.error) return NextResponse.json({ ok: false, error: votes.error.message }, { status: 400 });

    const upvotes = (votes.data ?? []).filter((row: any) => Number(row.vote) === 1).length;
    const downvotes = (votes.data ?? []).filter((row: any) => Number(row.vote) === -1).length;

    const update = await service
      .from("article_comments")
      .update({ upvotes, downvotes })
      .eq("id", commentId)
      .select("id,upvotes,downvotes,score")
      .limit(1)
      .maybeSingle();

    if (update.error) return NextResponse.json({ ok: false, error: update.error.message }, { status: 400 });

    return NextResponse.json({ ok: true, comment: update.data });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message ?? "Unknown error" }, { status: 500 });
  }
}
