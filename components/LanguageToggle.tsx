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

export function LanguageToggle() {
  const [lang, setLang] = useState<AppLang>("es");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    const setLanguage = async (nextLang: AppLang, persistProfile = false) => {
      writeLangPersistence(nextLang);
      if (mounted) setLang(nextLang);
      emitLanguageChange(nextLang);

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

    bootstrapLanguage();
    setReady(true);

    return () => {
      mounted = false;
    };
  }, []);

  const actions = useMemo(
    () => ({
      es: async () => {
        const nextLang: AppLang = "es";
        writeLangPersistence(nextLang);
        setLang(nextLang);
        emitLanguageChange(nextLang);

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) await supabase.from("users").update({ preferred_language: nextLang }).eq("id", userId);

        // Force re-render of Server Components in the new language.
        window.location.reload();
      },
      en: async () => {
        const nextLang: AppLang = "en";
        writeLangPersistence(nextLang);
        setLang(nextLang);
        emitLanguageChange(nextLang);

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (userId) await supabase.from("users").update({ preferred_language: nextLang }).eq("id", userId);

        // Force re-render of Server Components in the new language.
        window.location.reload();
      }
    }),
    [ready]
  );

  return (
    <>
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
