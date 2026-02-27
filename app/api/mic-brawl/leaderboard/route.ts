import { NextRequest, NextResponse } from "next/server";
import { createServiceClient, readTokenFromRequest, resolveUserFromRequest } from "@/lib/micBrawlServer";

export async function GET(request: NextRequest) {
  try {
    const service = createServiceClient();
    const { data: top, error: topError } = await service
      .from("profiles")
      .select("id,handle,equipped_skin,wins,losses,kos,matches")
      .order("wins", { ascending: false })
      .order("kos", { ascending: false })
      .order("matches", { ascending: false })
      .limit(20);

    if (topError) return NextResponse.json({ ok: false, error: topError.message }, { status: 400 });

    let me: any = null;
    let myRank: number | null = null;

    const token = readTokenFromRequest(request);
    if (token) {
      const session = await resolveUserFromRequest(request);
      if (session?.user?.id) {
        const { data: mine } = await service
          .from("profiles")
          .select("id,handle,equipped_skin,wins,losses,kos,matches")
          .eq("id", session.user.id)
          .maybeSingle();
        me = mine ?? null;

        if (mine) {
          const { count } = await service
            .from("profiles")
            .select("id", { head: true, count: "exact" })
            .or(
              `wins.gt.${mine.wins},and(wins.eq.${mine.wins},kos.gt.${mine.kos}),and(wins.eq.${mine.wins},kos.eq.${mine.kos},matches.gt.${mine.matches})`
            );
          myRank = Number(count ?? 0) + 1;
        }
      }
    }

    return NextResponse.json({ ok: true, top: top ?? [], me, myRank });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "Error cargando leaderboard." }, { status: 500 });
  }
}

