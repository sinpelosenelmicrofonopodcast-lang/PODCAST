"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { APP_LANG_EVENT, readStoredLang, type AppLang } from "@/lib/language";

const TERMS_GATE_VERSION = "v1";
const TERMS_GATE_STORAGE_KEY = "spm_terms_gate_ack";
const BLOCKED_PREFIXES = ["/admin"];
const SKIP_PATHS = new Set(["/terminos"]);

type GateTexts = {
  title: string;
  subtitle: string;
  age: string;
  terms: string;
  readTerms: string;
  accept: string;
  note: string;
};

const texts: Record<AppLang, GateTexts> = {
  es: {
    title: "Acceso 21+ obligatorio",
    subtitle: "Para continuar debes confirmar edad y aceptar los términos de Sin Pelos en el Micrófono.",
    age: "Certifico que tengo 21 años o más.",
    terms: "Acepto los términos y condiciones y la exención de responsabilidad.",
    readTerms: "Leer términos completos",
    accept: "Aceptar y entrar",
    note: "Si no estás de acuerdo, debes salir de la plataforma."
  },
  en: {
    title: "21+ access required",
    subtitle: "To continue, confirm your age and accept Sin Pelos en el Micrófono terms.",
    age: "I certify I am 21 years old or older.",
    terms: "I accept the terms, conditions, and liability disclaimer.",
    readTerms: "Read full terms",
    accept: "Accept and continue",
    note: "If you do not agree, you must leave the platform."
  }
};

function isGatePathBlocked(pathname: string | null): boolean {
  if (!pathname) return false;
  if (SKIP_PATHS.has(pathname)) return true;
  return BLOCKED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function TermsConsentPopup() {
  const pathname = usePathname();
  const [lang, setLang] = useState<AppLang>("es");
  const [open, setOpen] = useState(false);
  const [confirmAge, setConfirmAge] = useState(false);
  const [confirmTerms, setConfirmTerms] = useState(false);

  const isBlockedPath = useMemo(() => isGatePathBlocked(pathname), [pathname]);

  useEffect(() => {
    const storedLang = readStoredLang();
    if (storedLang) setLang(storedLang);
    const onLangChange = (event: Event) => {
      const custom = event as CustomEvent<{ lang?: AppLang }>;
      if (custom.detail?.lang) setLang(custom.detail.lang);
    };
    window.addEventListener(APP_LANG_EVENT, onLangChange);
    return () => window.removeEventListener(APP_LANG_EVENT, onLangChange);
  }, []);

  useEffect(() => {
    if (isBlockedPath) {
      setOpen(false);
      return;
    }
    const stored = window.localStorage.getItem(TERMS_GATE_STORAGE_KEY);
    setOpen(stored !== TERMS_GATE_VERSION);
  }, [isBlockedPath]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const onAccept = () => {
    if (!confirmAge || !confirmTerms) return;
    window.localStorage.setItem(TERMS_GATE_STORAGE_KEY, TERMS_GATE_VERSION);
    document.cookie = `spm_terms_gate=${TERMS_GATE_VERSION};path=/;max-age=31536000;samesite=lax`;
    setOpen(false);
  };

  if (!open) return null;

  const t = texts[lang];

  return (
    <div className="terms-gate-backdrop" role="dialog" aria-modal="true" aria-label={t.title}>
      <div className="terms-gate-card">
        <span className="badge">{t.title}</span>
        <h2>{t.title}</h2>
        <p className="muted">{t.subtitle}</p>
        <label className="terms-gate-check">
          <input type="checkbox" checked={confirmAge} onChange={(e) => setConfirmAge(e.target.checked)} />
          <span>{t.age}</span>
        </label>
        <label className="terms-gate-check">
          <input type="checkbox" checked={confirmTerms} onChange={(e) => setConfirmTerms(e.target.checked)} />
          <span>{t.terms}</span>
        </label>
        <div className="terms-gate-actions">
          <Link className="button secondary" href="/terminos" target="_blank" rel="noreferrer">
            {t.readTerms}
          </Link>
          <button className="button" type="button" disabled={!confirmAge || !confirmTerms} onClick={onAccept}>
            {t.accept}
          </button>
        </div>
        <p className="terms-gate-note">{t.note}</p>
      </div>
    </div>
  );
}
