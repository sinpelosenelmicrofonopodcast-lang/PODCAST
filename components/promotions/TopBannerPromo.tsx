"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { trackPromoEvent } from "@/lib/promoTracking";

type Promo = {
  id: string;
  title: string;
  description: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

export function TopBannerPromo() {
  const pathname = usePathname() ?? "/";
  const [promo, setPromo] = useState<Promo | null>(null);
  const sentImpression = useRef(false);

  // Always reserve space (no CLS). Content can be empty if no promo active.
  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/promotions/active?placement=top_banner&limit=1", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const json = await res.json().catch(() => null);
      const item = (json?.items?.[0] ?? null) as Promo | null;
      setPromo(item);
      sentImpression.current = false;
    };
    run();
  }, []);

  const canShow = useMemo(() => {
    // Avoid promos on admin pages.
    return !pathname.startsWith("/admin");
  }, [pathname]);

  useEffect(() => {
    if (!canShow) return;
    if (!promo) return;
    if (sentImpression.current) return;
    sentImpression.current = true;
    trackPromoEvent({ promotionId: promo.id, placement: "top_banner", event: "impression", path: pathname });
  }, [promo, pathname, canShow]);

  const onClick = () => {
    if (!promo) return;
    trackPromoEvent({ promotionId: promo.id, placement: "top_banner", event: "click", path: pathname });
  };

  if (!canShow) return <div className="promo-top-slot" aria-hidden="true" />;

  const clickable = Boolean(promo?.cta_url);
  const ctaLabel = promo?.cta_label ?? "Ver";
  const title = promo?.title ?? "";
  const desc = promo?.description ?? "";

  return (
    <div className="promo-top-slot" role="complementary" aria-label="Promoción">
      {promo ? (
        <div className="promo-top-inner">
          <div className="promo-top-text">
            <div className="promo-top-title clamp-2">{title}</div>
            {desc ? <div className="promo-top-desc clamp-2">{desc}</div> : null}
          </div>
          {clickable ? (
            <a className="button promo-top-cta" href={promo.cta_url ?? "#"} target="_blank" rel="noreferrer" onClick={onClick}>
              {ctaLabel}
            </a>
          ) : (
            <span className="muted" style={{ fontSize: 12 }}>—</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

