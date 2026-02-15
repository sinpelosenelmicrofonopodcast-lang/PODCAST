"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { trackPromoEvent } from "@/lib/promoTracking";

type Promo = {
  id: string;
  title: string;
  description: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

export function MidContentAdSlot() {
  const pathname = usePathname() ?? "/";
  const ref = useRef<HTMLDivElement | null>(null);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const sentImpression = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        obs.disconnect();
        if (loaded) return;
        setLoaded(true);
      },
      { rootMargin: "200px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    const run = async () => {
      const res = await fetch("/api/promotions/active?placement=mid_content&limit=1", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const json = await res.json().catch(() => null);
      const item = (json?.items?.[0] ?? null) as Promo | null;
      setPromo(item);
      sentImpression.current = false;
    };
    run();
  }, [loaded]);

  useEffect(() => {
    if (!promo) return;
    if (sentImpression.current) return;
    sentImpression.current = true;
    trackPromoEvent({ promotionId: promo.id, placement: "mid_content", event: "impression", path: pathname });
  }, [promo, pathname]);

  const onClick = () => {
    if (!promo) return;
    trackPromoEvent({ promotionId: promo.id, placement: "mid_content", event: "click", path: pathname });
  };

  return (
    <div ref={ref} className="mid-ad-slot" aria-label="Promoción">
      {promo ? (
        <div className="card mid-ad">
          <div className="mid-ad-top">
            <span className="badge">Patrocinado</span>
          </div>
          <div className="mid-ad-title clamp-2">{promo.title}</div>
          {promo.description ? <div className="muted mid-ad-desc clamp-3">{promo.description}</div> : null}
          {promo.cta_url ? (
            <a className="button secondary" href={promo.cta_url} target="_blank" rel="noreferrer" onClick={onClick}>
              {promo.cta_label ?? "Ver"}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

