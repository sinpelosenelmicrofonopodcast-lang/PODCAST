"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getSessionId, trackPromoEvent } from "@/lib/promoTracking";
import { promoSectionFromPath, type PromoSection } from "@/lib/promoSection";

type Promo = {
  id: string;
  title: string;
  description: string | null;
  image_url?: string | null;
  cta_label: string | null;
  cta_url: string | null;
  promo_type?: "sponsor" | "internal" | "affiliate" | null;
};

type MidContentAdSlotProps = {
  placement?: string;
  section?: PromoSection;
  className?: string;
  compact?: boolean;
  houseFallback?: boolean;
};

export function MidContentAdSlot({
  placement = "mid_content",
  section,
  className,
  compact = false,
  houseFallback = true
}: MidContentAdSlotProps = {}) {
  const pathname = usePathname() ?? "/";
  const currentSection = section ?? promoSectionFromPath(pathname);
  const ref = useRef<HTMLDivElement | null>(null);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [animate, setAnimate] = useState(false);
  const sentImpression = useRef(false);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) return;
        obs.disconnect();
        if (!loaded) setLoaded(true);
      },
      { rootMargin: "320px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    let active = true;
    const run = async () => {
      const sid = getSessionId();
      const res = await fetch(
        `/api/promotions/active?placement=${encodeURIComponent(placement)}&limit=1&section=${encodeURIComponent(currentSection)}&sid=${encodeURIComponent(sid)}`,
        { cache: "no-store" }
      ).catch(() => null);
      if (!active) return;
      if (!res?.ok) {
        setPromo(null);
        setResolved(true);
        return;
      }
      const json = await res.json().catch(() => null);
      const item = (json?.items?.[0] ?? null) as Promo | null;
      setPromo(item);
      setResolved(true);
      sentImpression.current = false;
    };
    run();
    return () => {
      active = false;
    };
  }, [loaded, currentSection, placement]);

  useEffect(() => {
    if (!promo) return;
    const key = `spm_promo_seen_${placement}_${currentSection}_${promo.id}`;
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
      placement,
      event: "impression",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  }, [promo, pathname, currentSection, placement]);

  const onClick = () => {
    if (!promo) return;
    trackPromoEvent({
      promotionId: promo.id,
      placement,
      event: "click",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  };

  return (
    <div ref={ref} className={`mid-ad-slot mid-ad-reserved ${compact ? "mid-ad-slot-compact" : ""} ${className ?? ""}`.trim()} aria-label="Promoción">
      {promo ? (
        <div className={`card mid-ad ${compact ? "mid-ad-compact" : ""} ${animate ? "promo-animate-in" : ""}`} data-type={promo.promo_type ?? "sponsor"}>
          <div className="mid-ad-top">
            <span className="badge">
              {promo.promo_type === "internal" ? "SPM" : promo.promo_type === "affiliate" ? "Recomendado" : "Patrocinado"}
            </span>
          </div>
          {promo.image_url ? (
            <div className="mid-ad-media" style={{ backgroundImage: `url(${promo.image_url})` }} aria-hidden="true" />
          ) : (
            <div className="mid-ad-media mid-ad-media-fallback" aria-hidden="true" />
          )}
          <div className="mid-ad-title clamp-2">{promo.title}</div>
          {promo.description ? <div className="muted mid-ad-desc clamp-3">{promo.description}</div> : null}
          {promo.cta_url ? (
            <a className="button secondary" href={promo.cta_url} target="_blank" rel="noreferrer" onClick={onClick}>
              {promo.cta_label ?? "Ver"}
            </a>
          ) : null}
        </div>
      ) : resolved && houseFallback ? (
        <a className={`card mid-ad mid-ad-house ${compact ? "mid-ad-compact" : ""}`} href="/publicidad">
          <div className="mid-ad-top"><span className="badge">ANÚNCIATE</span></div>
          <div className="mid-ad-title">Tu marca puede ocupar este espacio.</div>
          <div className="muted mid-ad-desc">Campañas en Sin Pelos con ubicación clara, impresiones, clics y CTR medibles.</div>
          <span className="button secondary">VER OPCIONES</span>
        </a>
      ) : (
        <div className="mid-ad-loading" aria-hidden="true" />
      )}
    </div>
  );
}
