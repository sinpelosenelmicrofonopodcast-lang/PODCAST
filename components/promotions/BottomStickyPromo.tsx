"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { trackPromoEvent } from "@/lib/promoTracking";

type Promo = {
  id: string;
  title: string;
  cta_label: string | null;
  cta_url: string | null;
};

export function BottomStickyPromo() {
  const pathname = usePathname() ?? "/";
  const [promo, setPromo] = useState<Promo | null>(null);
  const [closed, setClosed] = useState(false);
  const sentImpression = useRef(false);

  const canShow = useMemo(() => {
    if (pathname.startsWith("/admin")) return false;
    if (pathname === "/login" || pathname === "/register" || pathname === "/reset") return false;
    return true;
  }, [pathname]);

  useEffect(() => {
    const run = async () => {
      const res = await fetch("/api/promotions/active?placement=bottom_sticky&limit=1", { cache: "no-store" }).catch(() => null);
      if (!res?.ok) return;
      const json = await res.json().catch(() => null);
      const item = (json?.items?.[0] ?? null) as Promo | null;
      setPromo(item);
      sentImpression.current = false;
      setClosed(false);
    };
    run();
  }, []);

  useEffect(() => {
    if (!promo) return;
    const key = `spm_bottom_dismiss_${promo.id}`;
    const dismissed = localStorage.getItem(key) === "1";
    if (dismissed) setClosed(true);
  }, [promo]);

  useEffect(() => {
    document.documentElement.style.setProperty("--promo-bottom-h", promo && canShow && !closed ? "70px" : "0px");
    return () => {
      document.documentElement.style.setProperty("--promo-bottom-h", "0px");
    };
  }, [promo, canShow, closed]);

  useEffect(() => {
    if (!canShow) return;
    if (!promo) return;
    if (closed) return;
    if (sentImpression.current) return;
    sentImpression.current = true;
    trackPromoEvent({ promotionId: promo.id, placement: "bottom_sticky", event: "impression", path: pathname });
  }, [promo, pathname, canShow, closed]);

  const onClick = () => {
    if (!promo) return;
    trackPromoEvent({ promotionId: promo.id, placement: "bottom_sticky", event: "click", path: pathname });
  };

  const onClose = () => {
    if (!promo) return;
    localStorage.setItem(`spm_bottom_dismiss_${promo.id}`, "1");
    setClosed(true);
    trackPromoEvent({ promotionId: promo.id, placement: "bottom_sticky", event: "dismiss", path: pathname });
  };

  if (!canShow) return null;
  if (!promo) return null;
  if (closed) return null;

  const clickable = Boolean(promo.cta_url);

  return (
    <div className="promo-bottom-wrap" role="complementary" aria-label="Promoción">
      <div className="promo-bottom-inner">
        <div className="promo-bottom-title clamp-2">{promo.title}</div>
        <div className="promo-bottom-actions">
          {clickable ? (
            <a className="button promo-bottom-cta" href={promo.cta_url ?? "#"} target="_blank" rel="noreferrer" onClick={onClick}>
              {promo.cta_label ?? "Ver"}
            </a>
          ) : null}
          <button className="promo-bottom-close" type="button" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

