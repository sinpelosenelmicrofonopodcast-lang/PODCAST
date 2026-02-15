"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const VISITOR_KEY = "sinpelos_visitor_id";
const SENT_PREFIX = "sinpelos_pv_sent";

function getVisitorId() {
  const stored = window.localStorage.getItem(VISITOR_KEY);
  if (stored) return stored;
  const generated = crypto.randomUUID();
  window.localStorage.setItem(VISITOR_KEY, generated);
  return generated;
}

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    if (pathname.startsWith("/admin")) return;

    const visitorId = getVisitorId();
    const today = new Date().toISOString().slice(0, 10);
    const sentKey = `${SENT_PREFIX}:${today}:${pathname}`;
    if (window.sessionStorage.getItem(sentKey)) return;

    const payload = {
      visitorId,
      path: pathname,
      referrer: document.referrer || null,
      userAgent: navigator.userAgent || null
    };

    fetch("/api/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {
      return null;
    });

    window.sessionStorage.setItem(sentKey, "1");
  }, [pathname]);

  return null;
}

