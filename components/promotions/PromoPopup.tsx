"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { trackPromoEvent } from "@/lib/promoTracking";

type Promo = {
  id: string;
  title: string;
  description: string | null;
  image_url?: string | null;
  cta_label: string | null;
  cta_url: string | null;
  promo_type?: "sponsor" | "internal" | "affiliate" | null;
};

function isDesktop() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer:fine)").matches ?? false;
}

export function PromoPopup() {
  const pathname = usePathname() ?? "/";
  const [promo, setPromo] = useState<Promo | null>(null);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<number | null>(null);
  const sentImpression = useRef(false);

  const canShow = useMemo(() => {
    if (pathname.startsWith("/admin")) return false;
    if (pathname === "/login" || pathname === "/register" || pathname === "/reset") return false;
    return true;
  }, [pathname]);

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/promotions/active?placement=popup&limit=1", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const json = await res.json().catch(() => null);
      const item = (json?.items?.[0] ?? null) as Promo | null;
      setPromo(item);
      setOpen(false);
      sentImpression.current = false;
    };
    run();
  }, []);

  useEffect(() => {
    if (!canShow) return;
    if (!promo) return;

    const key = `spm_popup_seen_${promo.id}`;
    if (sessionStorage.getItem(key) === "1") return;

    // Delay trigger (25s)
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      sessionStorage.setItem(key, "1");
      setOpen(true);
    }, 25_000);

    // Exit intent trigger (desktop only)
    const onMouseLeave = (e: MouseEvent) => {
      if (!isDesktop()) return;
      if (e.clientY > 0) return;
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
      setOpen(true);
    };
    window.addEventListener("mouseleave", onMouseLeave);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [promo, canShow]);

  useEffect(() => {
    if (!open) return;
    if (!promo) return;
    if (sentImpression.current) return;
    sentImpression.current = true;
    trackPromoEvent({
      promotionId: promo.id,
      placement: "popup",
      event: "impression",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  }, [open, promo, pathname]);

  const onClose = () => {
    if (!promo) return;
    setOpen(false);
    trackPromoEvent({
      promotionId: promo.id,
      placement: "popup",
      event: "dismiss",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  };

  const onClick = () => {
    if (!promo) return;
    trackPromoEvent({
      promotionId: promo.id,
      placement: "popup",
      event: "click",
      path: pathname,
      promoType: promo.promo_type ?? null
    });
  };

  if (!canShow) return null;
  if (!promo) return null;
  if (!open) return null;

  return (
    <div className="promo-popup-wrap" role="dialog" aria-modal="false" aria-label="Sugerencia">
      <div className="promo-popup card" data-type={promo.promo_type ?? "sponsor"}>
        <div className="promo-popup-top">
          <span className="badge">Nuevo</span>
          <button className="promo-popup-close" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
        {promo.image_url ? (
          <div className="promo-popup-media" style={{ backgroundImage: `url(${promo.image_url})` }} aria-hidden="true" />
        ) : (
          <div className="promo-popup-media promo-popup-media-fallback" aria-hidden="true" />
        )}
        <div className="promo-popup-title">{promo.title}</div>
        {promo.description ? <div className="muted promo-popup-desc">{promo.description}</div> : null}
        <div className="promo-popup-actions">
          {promo.cta_url ? (
            <a className="button" href={promo.cta_url} onClick={onClick}>
              {promo.cta_label ?? "Abrir"}
            </a>
          ) : null}
          <button className="button secondary" type="button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
