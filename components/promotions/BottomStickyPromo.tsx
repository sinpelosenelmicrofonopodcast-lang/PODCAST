"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

export function BottomStickyPromo() {
  const pathname = usePathname() ?? "/";
  const section = promoSectionFromPath(pathname);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [closed, setClosed] = useState(false);
  const [animate, setAnimate] = useState(false);
  const sentImpression = useRef(false);

  const canShow = useMemo(() => {
    if (pathname.startsWith("/admin")) return false;
    if (pathname === "/login" || pathname === "/register" || pathname === "/reset") return false;
    return true;
  }, [pathname]);

  useEffect(() => {
    if (!canShow) return;
    const run = async () => {
      const sid = getSessionId();
      const res = await fetch(
        `/api/promotions/active?placement=bottom_sticky&limit=1&section=${encodeURIComponent(section)}&sid=${encodeURIComponent(sid)}`,
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
      setClosed(false);
    };
    run();
  }, [section, canShow]);

  useEffect(() => {
    if (!promo) return;
    const key = `spm_bottom_dismiss_${promo.id}`;
    const dismissed = localStorage.getItem(key) === "1";
    if (dismissed) setClosed(true);
  }, [promo]);

  useEffect(() => {
    if (!promo || !canShow || closed) return;
    const key = `spm_promo_seen_bottom_${section}_${promo.id}`;
    const seen = sessionStorage.getItem(key) === "1";
    if (!seen) {
      sessionStorage.setItem(key, "1");
      setAnimate(true);
      window.setTimeout(() => setAnimate(false), 420);
    }
  }, [promo, section, canShow, closed]);

  useEffect(() => {
    document.documentElement.style.setProperty("--promo-bottom-h", promo && canShow && !closed ? "64px" : "0px");
    return () => document.documentElement.style.setProperty("--promo-bottom-h", "0px");
  }, [promo, canShow, closed]);

  useEffect(() => {
    if (!canShow || !promo || closed || sentImpression.current) return;
    sentImpression.current = true;
    trackPromoEvent({
      promotionId: promo.id,
      placement: "bottom_sticky",
      event: "impression",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  }, [promo, pathname, canShow, closed]);

  const onClick = () => {
    if (!promo) return;
    trackPromoEvent({
      promotionId: promo.id,
      placement: "bottom_sticky",
      event: "click",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  };

  const onClose = () => {
    if (!promo) return;
    localStorage.setItem(`spm_bottom_dismiss_${promo.id}`, "1");
    setClosed(true);
    trackPromoEvent({
      promotionId: promo.id,
      placement: "bottom_sticky",
      event: "dismiss",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  };

  if (!canShow || !promo || closed) return null;

  return (
    <div className={`promo-bottom-wrap ${animate ? "promo-animate-in" : ""}`} role="complementary" aria-label="Promoción" data-type={promo.promo_type ?? "sponsor"}>
      <div className="promo-bottom-inner">
        <div className="promo-bottom-left">
          <div className="promo-bottom-media" aria-hidden="true">
            <img src={promo.image_url || "/logo.png"} alt="" width={44} height={44} loading="lazy" decoding="async" />
          </div>
          <div className="promo-bottom-title clamp-2">{promo.title}</div>
        </div>
        <div className="promo-bottom-actions">
          {promo.cta_url ? (
            <a className="button promo-bottom-cta" href={promo.cta_url} target="_blank" rel="noreferrer" onClick={onClick}>
              {promo.cta_label ?? "Ver"}
            </a>
          ) : null}
          <button className="promo-bottom-close" type="button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
      </div>
    </div>
  );
}
