"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { usePathname } from "next/navigation";
import { getSessionId, trackPromoEvent } from "@/lib/promoTracking";
import { promoSectionFromPath } from "@/lib/promoSection";

type Promo = {
  id: string;
  title: string;
  image_url?: string | null;
  cta_label: string | null;
  cta_url: string | null;
  promo_type?: "sponsor" | "internal" | "affiliate" | null;
};

const HOUSE_PROMO = {
  title: "¿Quieres tu marca aquí? Anúnciate con Sin Pelos.",
  image_url: "/logo.png",
  cta_label: "Anúnciate",
  cta_url: "/publicidad",
  promo_type: "internal" as const
};

export function TopBannerPromo() {
  const pathname = usePathname() ?? "/";
  const section = promoSectionFromPath(pathname);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [animate, setAnimate] = useState(false);
  const sentImpression = useRef(false);

  const canShow = useMemo(() => !pathname.startsWith("/admin"), [pathname]);

  useEffect(() => {
    if (!canShow) return;
    const run = async () => {
      const sid = getSessionId();
      const res = await fetch(
        `/api/promotions/active?placement=top_banner&limit=1&section=${encodeURIComponent(section)}&sid=${encodeURIComponent(sid)}`,
        { cache: "no-store" }
      ).catch(() => null);
      if (!res?.ok) {
        setPromo(null);
        return;
      }
      const json = await res.json().catch(() => null);
      const item = (json?.items?.[0] ?? null) as Promo | null;
      setPromo(item);
      sentImpression.current = false;
    };
    run();
  }, [section, canShow]);

  useEffect(() => {
    if (!canShow || !promo) return;

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

  if (!canShow) return null;

  const display = promo ?? HOUSE_PROMO;
  const clickable = Boolean(display.cta_url);
  const ctaLabel = display.cta_label ?? "Ver";
  const title = display.title ?? "";
  const imageUrl = display.image_url ?? "/logo.png";
  const promoType = display.promo_type ?? "sponsor";

  const Root: any = clickable ? "a" : "div";
  const isExternal = Boolean(display.cta_url?.startsWith("http"));
  const rootProps = clickable
    ? {
        href: display.cta_url ?? "#",
        ...(isExternal ? { target: "_blank", rel: "noreferrer" } : {}),
        onClick: promo ? onClick : undefined
      }
    : {};
  const rootStyle = imageUrl
    ? ({ ["--promo-bg" as any]: `url("${imageUrl}")` } as CSSProperties)
    : undefined;

  return (
    <div className="promo-top-slot" role="complementary" aria-label="Promoción" data-type={promoType}>
      <Root
        className={`promo-top-inner promo-top-banner ${animate ? "promo-animate-in" : ""}`}
        aria-label={title || "Promoción"}
        style={rootStyle}
        {...rootProps}
      >
        <div className="promo-top-media" aria-hidden="true">
          <img src={imageUrl} alt="" width={34} height={34} loading="eager" decoding="async" />
        </div>

        <div className="promo-top-content">
          <div className="promo-top-one">
            <span className="promo-top-label">
              {promoType === "internal" ? "SPM" : promoType === "affiliate" ? "RECOMENDADO" : "SPONSOR"}
            </span>
            <span className="promo-top-title clamp-2">{title}</span>
          </div>
        </div>

        <div className="promo-top-right">
          <span className="promo-top-cta">{ctaLabel}</span>
        </div>
      </Root>
    </div>
  );
}
