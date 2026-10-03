"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getSessionId, trackPromoEvent } from "@/lib/promoTracking";
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
  const slotRef = useRef<HTMLElement | null>(null);
  const [promo, setPromo] = useState<Promo | null>(null);
  const sentImpression = useRef(false);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const sid = getSessionId();
      const res = await fetch(
        `/api/promotions/active?placement=side_sticky&limit=1&section=${encodeURIComponent(currentSection)}&sid=${encodeURIComponent(sid)}`,
        { cache: "no-store" }
      ).catch(() => null);
      if (!active) return;
      if (!res?.ok) {
        setPromo(null);
        return;
      }
      const json = await res.json().catch(() => null);
      setPromo((json?.items?.[0] ?? null) as Promo | null);
      sentImpression.current = false;
    };
    run();
    return () => {
      active = false;
    };
  }, [currentSection]);

  useEffect(() => {
    if (!promo || sentImpression.current || !slotRef.current) return;
    const el = slotRef.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting || first.intersectionRatio < 0.5 || sentImpression.current) return;
        sentImpression.current = true;
        trackPromoEvent({
          promotionId: promo.id,
          placement: "side_sticky",
          event: "impression",
          path: pathname,
          promoType: promo.promo_type ?? null
        });
        obs.disconnect();
      },
      { threshold: [0.5] }
    );
    obs.observe(el);
    return () => obs.disconnect();
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

  if (!promo) return null;

  const content = (
    <>
      <span className="news-side-ad-label">
        {promo.promo_type === "internal" ? "SPM" : promo.promo_type === "affiliate" ? "Recomendado" : "Sponsor"}
      </span>
      <div className="news-side-ad-media">
        <img src={promo.image_url || "/logo.png"} alt={promo.title} width={300} height={600} loading="lazy" decoding="async" />
      </div>
      <div className="news-side-ad-title clamp-2">{promo.title}</div>
      {promo.cta_url ? <span className="news-side-ad-cta">{promo.cta_label ?? "Ver"}</span> : null}
    </>
  );

  return (
    <aside ref={slotRef} className="news-side-ad" aria-label="Promoción lateral">
      {promo.cta_url ? (
        <a
          className="news-side-ad-inner"
          href={promo.cta_url}
          target="_blank"
          rel={promo.promo_type === "internal" ? "noopener noreferrer" : "sponsored noopener noreferrer"}
          onClick={onClick}
        >
          {content}
        </a>
      ) : (
        <div className="news-side-ad-inner">{content}</div>
      )}
    </aside>
  );
}
