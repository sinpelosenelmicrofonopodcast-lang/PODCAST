"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { trackPromoEvent } from "@/lib/promoTracking";
import { promoSectionFromPath, type PromoSection } from "@/lib/promoSection";

type Promo = {
  id: string;
  title: string;
  image_url?: string | null;
  cta_label: string | null;
  cta_url: string | null;
  promo_type?: "sponsor" | "internal" | "affiliate" | null;
};

export function DesktopSideAdSlot({ section }: { section?: PromoSection }) {
  const pathname = usePathname() ?? "/";
  const autoSection = promoSectionFromPath(pathname);
  const currentSection = section ?? autoSection;
  const [promo, setPromo] = useState<Promo | null>(null);
  const sentImpression = useRef(false);

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/promotions/active?placement=mid_content&limit=1&section=${encodeURIComponent(currentSection)}`, {
        cache: "no-store"
      }).catch(() => null);
      if (!res?.ok) return;
      const json = await res.json().catch(() => null);
      setPromo((json?.items?.[0] ?? null) as Promo | null);
      sentImpression.current = false;
    };
    run();
  }, [currentSection]);

  useEffect(() => {
    if (!promo) return;
    if (sentImpression.current) return;
    sentImpression.current = true;
    trackPromoEvent({
      promotionId: promo.id,
      placement: "side_sticky",
      event: "impression",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  }, [promo, pathname]);

  const onClick = () => {
    if (!promo) return;
    trackPromoEvent({
      promotionId: promo.id,
      placement: "side_sticky",
      event: "click",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  };

  if (!promo || !promo.cta_url) return null;

  return (
    <aside className="news-side-ad" aria-label="Promoción lateral">
      <a className="news-side-ad-inner" href={promo.cta_url} target="_blank" rel="noreferrer" onClick={onClick}>
        <span className="news-side-ad-label">
          {promo.promo_type === "internal" ? "SPM" : promo.promo_type === "affiliate" ? "Recomendado" : "Sponsor"}
        </span>
        <div className="news-side-ad-media">
          <img src={promo.image_url || "/logo.png"} alt={promo.title} loading="lazy" decoding="async" />
        </div>
        <div className="news-side-ad-title clamp-2">{promo.title}</div>
        <span className="news-side-ad-cta">{promo.cta_label ?? "Ver"}</span>
      </a>
    </aside>
  );
}

