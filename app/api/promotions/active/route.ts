import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export const revalidate = 60;

function shuffle<T>(input: T[]) {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function rotateByPriority(items: any[], limit: number) {
  if (!items.length) return [];
  const priorities = Array.from(new Set(items.map((item) => Number(item?.display_order ?? 0)))).sort((a, b) => a - b);
  const ordered: any[] = [];
  for (const priority of priorities) {
    ordered.push(...shuffle(items.filter((item) => Number(item?.display_order ?? 0) === priority)));
  }
  return ordered.slice(0, limit);
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const placement = (url.searchParams.get("placement") ?? "toast").trim();
    const section = (url.searchParams.get("section") ?? "").trim();
    const limit = Math.min(10, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
    const dbLimit = section ? Math.min(30, Math.max(limit * 8, 12)) : Math.min(30, Math.max(limit * 6, 10));
    const nowIso = new Date().toISOString();

    const supabase = supabaseServer();
    const run = async (selectCols: string) => {
      const q = supabase
        .from("promotions")
        .select(selectCols)
        .eq("is_active", true)
        .eq("placement", placement)
        .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
        .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(dbLimit);
      return q;
    };

    let { data, error } = await run(
      "id, title, description, image_url, cta_label, cta_url, placement, display_order, starts_at, ends_at, promo_type, target_sections"
    );
    if (error && /(promo_type|target_sections)/i.test(error.message)) {
      const fallback = await run(
        "id, title, description, image_url, cta_label, cta_url, placement, display_order, starts_at, ends_at"
      );
      data = fallback.data;
      error = fallback.error;
    }

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

    let items = (data ?? []) as any[];
    if (section && items.length) {
      const sec = section.toLowerCase();
      const targeted: any[] = [];
      const global: any[] = [];

      for (const promo of items) {
        const targets = promo?.target_sections;
        if (!targets || (Array.isArray(targets) && targets.length === 0) || !Array.isArray(targets)) {
          global.push(promo);
          continue;
        }
        const normalized = targets.map((value: unknown) => String(value).toLowerCase());
        if (normalized.includes(sec)) targeted.push(promo);
        else if (normalized.includes("all") || normalized.includes("global")) global.push(promo);
      }

      items = targeted.length ? targeted : global;
    }

    return NextResponse.json({ ok: true, items: rotateByPriority(items, limit) });
  } catch (error: any) {
    console.error("active promotion selection failed", error?.message ?? error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
