"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type Promo = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
};

const CLOSED_UNTIL_KEY = "sinpelos_promo_toast_closed_until";

function msUntilTomorrowLocal() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.getTime() - now.getTime();
}

export function PromotionsToast({
  placement = "toast",
  secondsPerPromo = 10
}: {
  placement?: string;
  secondsPerPromo?: number;
}) {
  const pathname = usePathname();
  const [items, setItems] = useState<Promo[]>([]);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const timerRef = useRef<number | null>(null);

  const isAdminPath = (pathname ?? "").startsWith("/admin");
  const isAuthPages =
    pathname === "/login" || pathname === "/register" || pathname === "/reset";

  useEffect(() => {
    if (!pathname) return;
    if (isAdminPath) return;

    const closedUntil = Number(window.localStorage.getItem(CLOSED_UNTIL_KEY) ?? "0");
    if (closedUntil && Date.now() < closedUntil) return;

    const run = async () => {
      const res = await fetch(`/api/promotions/active?placement=${encodeURIComponent(placement)}`, {
        cache: "no-store"
      }).catch(() => null);
      if (!res?.ok) return;
      const json = await res.json().catch(() => null);
      const promos = (json?.items ?? []) as Promo[];
      if (promos.length === 0) return;
      setItems(promos);
      setIndex(0);
      setOpen(true);
    };

    run();
  }, [pathname, placement, isAdminPath]);

  const promo = useMemo(() => {
    if (items.length === 0) return null;
    return items[index % items.length] ?? null;
  }, [items, index]);

  useEffect(() => {
    if (!open) return;
    if (!promo) return;
    if (items.length <= 1) return;

    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setIndex((i) => i + 1);
    }, Math.max(3, secondsPerPromo) * 1000);

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [open, promo, items.length, secondsPerPromo]);

  if (!open || !promo) return null;
  if (isAdminPath) return null;

  const dismiss = () => {
    const until = Date.now() + msUntilTomorrowLocal();
    window.localStorage.setItem(CLOSED_UNTIL_KEY, String(until));
    setOpen(false);
  };

  const clickable = Boolean(promo.cta_url);

  return (
    <div className="promo-toast-wrap" data-auth={isAuthPages ? "1" : "0"}>
      <div className="promo-toast card" role="complementary" aria-label="Promoción">
        <div className="promo-toast-top">
          <span className="badge">Promoción</span>
          <button className="promo-toast-close" type="button" onClick={dismiss} aria-label="Cerrar promoción">
            ×
          </button>
        </div>

        {promo.image_url ? (
          <div className="promo-toast-media" style={{ backgroundImage: `url(${promo.image_url})` }} aria-hidden="true" />
        ) : (
          <div className="promo-toast-media promo-toast-media-fallback" aria-hidden="true" />
        )}

        <div className="promo-toast-body">
          <div className="promo-toast-title">{promo.title}</div>
          {promo.description ? <div className="promo-toast-desc muted">{promo.description}</div> : null}

          {clickable ? (
            <a className="button promo-toast-cta" href={promo.cta_url ?? "#"} target="_blank" rel="noreferrer">
              {promo.cta_label ?? "Ver promoción"}
            </a>
          ) : (
            <div className="muted" style={{ fontSize: 12 }}>
              Sin link configurado
            </div>
          )}
        </div>

        {items.length > 1 ? (
          <div className="promo-toast-progress" aria-hidden="true">
            <div
              key={promo.id}
              className="promo-toast-progress-bar"
              style={{ animationDuration: `${Math.max(3, secondsPerPromo)}s` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

