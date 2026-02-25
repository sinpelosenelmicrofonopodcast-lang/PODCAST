"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ui } from "@/lib/i18n";
import { APP_LANG_EVENT, readStoredLang, type AppLang } from "@/lib/language";

const STORAGE_KEY = "sinpelos_guest_popup_closed";

export function GuestInvitePopup() {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<AppLang>("es");

  useEffect(() => {
    const stored = readStoredLang();
    if (stored) setLang(stored);
    const onLangChange = (event: Event) => {
      const custom = event as CustomEvent<{ lang?: AppLang }>;
      if (custom.detail?.lang) setLang(custom.detail.lang);
    };
    window.addEventListener(APP_LANG_EVENT, onLangChange);

    const closed = window.localStorage.getItem(STORAGE_KEY);
    if (!closed) {
      const timer = window.setTimeout(() => setOpen(true), 500);
      return () => {
        window.clearTimeout(timer);
        window.removeEventListener(APP_LANG_EVENT, onLangChange);
      };
    }
    return () => window.removeEventListener(APP_LANG_EVENT, onLangChange);
  }, []);

  const close = () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  const t = ui[lang];

  return (
    <div className="guest-popup-backdrop" role="dialog" aria-modal="true" aria-label="Invitación para ser parte del panel">
      <div className="guest-popup-card">
        <span className="badge">{t.guest.title}</span>
        <h3>{t.guest.cta}</h3>
        <p className="muted">{t.guest.subtitle}</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="button" href="/quiero-salir" onClick={close}>
            {t.guest.cta}
          </Link>
          <button className="button secondary" type="button" onClick={close}>
            {t.guest.close}
          </button>
        </div>
      </div>
    </div>
  );
}
