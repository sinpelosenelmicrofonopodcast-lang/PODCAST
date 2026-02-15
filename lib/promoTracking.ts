export type PromoEvent = "impression" | "click" | "dismiss";
export type PromoType = "sponsor" | "internal" | "affiliate";

export function getSessionId(): string {
  const key = "spm_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;
  const id = `${Date.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
  sessionStorage.setItem(key, id);
  return id;
}

export async function trackPromoEvent(params: {
  promotionId: string;
  placement: string;
  event: PromoEvent;
  path: string;
  promoType?: PromoType | null;
}) {
  try {
    const sessionId = getSessionId();
    await fetch("/api/analytics/promo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, sessionId })
    });
  } catch {
    // tracking is best-effort
  }
}
