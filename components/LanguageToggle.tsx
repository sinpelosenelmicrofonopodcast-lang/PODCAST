"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  detectBrowserLang,
  emitLanguageChange,
  normalizeLang,
  readStoredLang,
  writeLangPersistence,
  type AppLang
} from "@/lib/language";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement?: new (
          options: { pageLanguage: string; includedLanguages: string; autoDisplay: boolean },
          elementId: string
        ) => unknown;
      };
    };
  }
}

function switchGoogleCombo(lang: AppLang) {
  const combo = document.querySelector<HTMLSelectElement>(".goog-te-combo");
  if (!combo) return false;
  combo.value = lang;
  combo.dispatchEvent(new Event("change"));
  return true;
}

export function LanguageToggle() {
  const [lang, setLang] = useState<AppLang>("es");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const setLanguage = async (nextLang: AppLang, persistProfile = false) => {
      writeLangPersistence(nextLang);
      if (mounted) setLang(nextLang);
      emitLanguageChange(nextLang);
      if (ready) switchGoogleCombo(nextLang);

      if (!persistProfile) return;
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;
      await supabase.from("users").update({ preferred_language: nextLang }).eq("id", userId);
    };

    const bootstrapLanguage = async () => {
      const stored = readStoredLang();
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (userId) {
        const { data } = await supabase.from("users").select("preferred_language").eq("id", userId).single();
        const rawProfile = (data as { preferred_language?: string } | null)?.preferred_language;
        if (rawProfile) {
          await setLanguage(normalizeLang(rawProfile), false);
          return;
        }
        if (stored) {
          await setLanguage(stored, true);
          return;
        }
        await setLanguage(detectBrowserLang(), true);
        return;
      }

      if (stored) {
        await setLanguage(stored, false);
        return;
      }

      const detected = detectBrowserLang();
      await setLanguage(detected, false);
    };

    const init = () => {
      if (!window.google?.translate?.TranslateElement) return;
      if (!document.getElementById("google_translate_element")) return;
      if (document.querySelector(".goog-te-combo")) {
        setReady(true);
        return;
      }
      // Hidden translate widget; we control language via toggle.
      new window.google.translate.TranslateElement(
        { pageLanguage: "es", includedLanguages: "es,en", autoDisplay: false },
        "google_translate_element"
      );
      setTimeout(() => setReady(true), 350);
    };

    window.googleTranslateElementInit = init;

    if (window.google?.translate?.TranslateElement) {
      init();
      return;
    }

    const existing = document.getElementById("google-translate-script");
    if (existing) return;

    const script = document.createElement("script");
    script.id = "google-translate-script";
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);

    bootstrapLanguage();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    switchGoogleCombo(lang);
  }, [lang, ready]);

  const actions = useMemo(
    () => ({
      es: async () => {
        const nextLang: AppLang = "es";
        writeLangPersistence(nextLang);
        setLang(nextLang);
        emitLanguageChange(nextLang);
        if (!switchGoogleCombo(nextLang) && ready) window.location.reload();

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) await supabase.from("users").update({ preferred_language: nextLang }).eq("id", userId);
      },
      en: async () => {
        const nextLang: AppLang = "en";
        writeLangPersistence(nextLang);
        setLang(nextLang);
        emitLanguageChange(nextLang);
        if (!switchGoogleCombo(nextLang) && ready) window.location.reload();

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) await supabase.from("users").update({ preferred_language: nextLang }).eq("id", userId);
      }
    }),
    [ready]
  );

  return (
    <>
      <div id="google_translate_element" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }} />
      <div className="lang-toggle" role="group" aria-label="Idioma">
        <button
          type="button"
          className={lang === "es" ? "active" : ""}
          onClick={actions.es}
          disabled={!ready && lang === "es"}
        >
          ES
        </button>
        <button
          type="button"
          className={lang === "en" ? "active" : ""}
          onClick={actions.en}
          disabled={!ready && lang === "en"}
        >
          EN
        </button>
      </div>
    </>
  );
}
