"use client";

import { useEffect, useMemo, useState } from "react";

export function ReadingProgressBar({ targetId = "reading-root" }: { targetId?: string }) {
  const [pct, setPct] = useState(0);

  const prefersReduced = useMemo(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  }, []);

  useEffect(() => {
    let raf = 0;
    const calc = () => {
      const el = document.getElementById(targetId);
      if (!el) return setPct(0);
      const rect = el.getBoundingClientRect();
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const top = rect.top + scrollTop;
      const height = Math.max(1, el.scrollHeight - window.innerHeight);
      const current = Math.min(1, Math.max(0, (scrollTop - top) / height));
      setPct(Math.round(current * 100));
    };

    const onScroll = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        calc();
      });
    };

    calc();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll as any);
      window.removeEventListener("resize", onScroll as any);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [targetId]);

  return (
    <div className="reading-progress" aria-hidden="true">
      <div
        className="reading-progress-bar"
        style={{
          width: `${pct}%`,
          transition: prefersReduced ? undefined : "width 120ms linear"
        }}
      />
    </div>
  );
}

