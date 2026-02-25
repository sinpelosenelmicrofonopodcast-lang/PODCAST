"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { trackPromoEvent } from "@/lib/promoTracking";
import { promoSectionFromPath } from "@/lib/promoSection";

type Promo = {
  id: string;
  title: string;
  image_url?: string | null;
  cta_label: string | null;
  cta_url: string | null;
  promo_type?: "sponsor" | "internal" | "affiliate" | null;
};

export function TopBannerPromo() {
  const pathname = usePathname() ?? "/";
  const section = promoSectionFromPath(pathname);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [animate, setAnimate] = useState(false);
  const sentImpression = useRef(false);

  // Always reserve space (no CLS). Content can be empty if no promo active.
  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/promotions/active?placement=top_banner&limit=1&section=${encodeURIComponent(section)}`, {
        cache: "no-store"
      }).catch(() => null);
      if (!res?.ok) return;
      const json = await res.json().catch(() => null);
      const item = (json?.items?.[0] ?? null) as Promo | null;
      setPromo(item);
      sentImpression.current = false;
    };
    run();
  }, [section]);

  const canShow = useMemo(() => {
    // Avoid promos on admin pages.
    return !pathname.startsWith("/admin");
  }, [pathname]);

  useEffect(() => {
    if (!canShow) return;
    if (!promo) return;

    const key = `spm_promo_seen_top_banner_${section}_${promo.id}`;
    const seen = sessionStorage.getItem(key) === "1";
    if (!seen) {
      sessionStorage.setItem(key, "1");
      setAnimate(true);
      window.setTimeout(() => setAnimate(false), 420);
    }

    if (sentImpression.current) return;
    sentImpression.current = true;
    trackPromoEvent({
      promotionId: promo.id,
      placement: "top_banner",
      event: "impression",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  }, [promo, pathname, canShow, section]);

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
  const imageUrl = promo?.image_url ?? null;

  const Root: any = clickable ? "a" : "div";
  const rootProps = clickable
    ? {
        href: promo?.cta_url ?? "#",
        target: "_blank",
        rel: "noreferrer",
        onClick
      }
    : {};
  const rootStyle = imageUrl
    ? ({
        ["--promo-bg" as any]: `url("${imageUrl}")`
      } as CSSProperties)
    : undefined;

  return (
    <div className="promo-top-slot" role="complementary" aria-label="Promoción" data-type={promo?.promo_type ?? "sponsor"}>
      {promo ? (
        <Root
          className={`promo-top-inner promo-top-banner ${animate ? "promo-animate-in" : ""}`}
          aria-label={title || "Promoción"}
          style={rootStyle}
          {...rootProps}
        >
          <div className="promo-top-media" aria-hidden="true">
            <img src={imageUrl || "/logo.png"} alt="" loading="lazy" decoding="async" />
          </div>

          <div className="promo-top-content">
            <div className="promo-top-one">
              <span className="promo-top-label">
                {promo.promo_type === "internal" ? "SPM" : promo.promo_type === "affiliate" ? "RECOMENDADO" : "SPONSOR"}
              </span>
              <span className="promo-top-title clamp-2">{title}</span>
            </div>
          </div>

          <div className="promo-top-right">
            <span className="promo-top-cta">{ctaLabel}</span>
          </div>
        </Root>
      ) : null}
    </div>
  );
}
