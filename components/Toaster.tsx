"use client";

import { useEffect, useRef, useState } from "react";
import { TOAST_EVENT, type ToastKind, type ToastPayload } from "@/lib/toast";

type ToastItem = {
  id: string;
  kind: ToastKind;
  message: string;
  ms: number;
};

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, number>());

  useEffect(() => {
    const onToast = (event: Event) => {
      const custom = event as CustomEvent<ToastPayload>;
      const msg = String(custom.detail?.message ?? "").trim();
      if (!msg) return;

      const item: ToastItem = {
        id: uid(),
        kind: custom.detail?.kind ?? "info",
        message: msg,
        ms: Math.max(1200, Number(custom.detail?.ms ?? 3200))
      };

      setItems((prev) => [item, ...prev].slice(0, 3));

      const t = window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== item.id));
        timers.current.delete(item.id);
      }, item.ms);
      timers.current.set(item.id, t);
    };

    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      for (const t of timers.current.values()) window.clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const dismiss = (id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  };

  if (items.length === 0) return null;

  return (
    <div className="toaster" role="status" aria-live="polite" aria-relevant="additions">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <div className="toast-msg">{t.message}</div>
          <button className="toast-x" type="button" onClick={() => dismiss(t.id)} aria-label="Cerrar">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

