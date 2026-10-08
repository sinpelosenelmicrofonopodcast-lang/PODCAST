"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
const KEY = "sinpelos_visitor_id";
function visitorId() {
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) return prev;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch { return crypto.randomUUID(); }
}
export function PageViewTracker() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path.startsWith("/admin")) return;
    // Count every real page load/navigation; previous daily session cap understated pageviews.
    void fetch("/api/analytics/pageview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId: visitorId(), path, referrer: document.referrer || null, userAgent: navigator.userAgent || null }),
      keepalive: true
    }).catch(() => null);
  }, [path]);
  return null;
}
