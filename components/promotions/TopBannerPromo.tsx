"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { trackPromoEvent } from "@/lib/promoTracking";

type Promo = {
  id: string;
  title: string;
  cta_label: string | null;
  cta_url: string | null;
  promo_type?: "sponsor" | "internal" | "affiliate" | null;
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
    trackPromoEvent({
      promotionId: promo.id,
      placement: "top_banner",
      event: "impression",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  }, [promo, pathname, canShow]);

  const onClick = () => {
    if (!promo) return;
    trackPromoEvent({
      promotionId: promo.id,
      placement: "top_banner",
      event: "click",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  };

  if (!canShow) return <div className="promo-top-slot" aria-hidden="true" />;

  const clickable = Boolean(promo?.cta_url);
  const ctaLabel = promo?.cta_label ?? "Ver";
  const title = promo?.title ?? "";

  return (
    <div className="promo-top-slot" role="complementary" aria-label="Promoción" data-type={promo?.promo_type ?? "sponsor"}>
      {promo ? (
        <div className="promo-top-inner">
          <div className="promo-top-one">
            <span className="promo-top-label">
              {promo.promo_type === "internal" ? "SPM" : promo.promo_type === "affiliate" ? "RECOMENDADO" : "SPONSOR"}
            </span>
            <span className="promo-top-title clamp-2">{title}</span>
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
