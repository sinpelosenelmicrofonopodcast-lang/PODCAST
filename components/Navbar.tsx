"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { navTexts } from "@/lib/i18n";
import { APP_LANG_EVENT, readStoredLang, type AppLang } from "@/lib/language";
import { supabase } from "@/lib/supabaseClient";

export function Navbar() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lang, setLang] = useState<AppLang>("es");

  useEffect(() => {
    let mounted = true;
    const initialLang = readStoredLang();
    if (initialLang) setLang(initialLang);

    const onLangChange = (event: Event) => {
      const custom = event as CustomEvent<{ lang?: AppLang }>;
      const nextLang = custom.detail?.lang;
      if (nextLang) setLang(nextLang);
    };
    window.addEventListener(APP_LANG_EVENT, onLangChange);

    const loadProfile = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { data: profile } = await supabase.from("users").select("nickname, avatar_url").eq("id", userId).single();
      if (mounted && profile?.nickname) setNickname(profile.nickname);
      if (mounted) setAvatarUrl(profile?.avatar_url ?? null);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", userId);
      const hasAdmin = roles?.some((row: any) => {
        const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
        return role?.name === "admin";
      }) ?? false;
      if (mounted) setIsAdmin(hasAdmin);
    };

    loadProfile();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
      window.removeEventListener(APP_LANG_EVENT, onLangChange);
    };
  }, []);

  const t = navTexts[lang];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setNickname(null);
    setAvatarUrl(null);
    setIsAdmin(false);
  };

  return (
    <nav className="nav">
      <div className="container nav-inner">
        <Link className="brand" href="/">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={44} animated />
            <span>Sin Pelos</span>
          </div>
        </Link>
        <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/feed">{t.feed}</Link>
          <Link href="/community">{t.community}</Link>
          <Link href="/foro">{t.forum}</Link>
          <Link href="/noticias">{t.news}</Link>
          <Link href="/blog">{t.blog}</Link>
          <Link href="/quiero-salir">{t.guest}</Link>
          <Link href="/zona-cruda">{t.rawZone}</Link>
          <LanguageToggle />
          {isAdmin ? <Link href="/admin">{t.dashboard}</Link> : null}
          {nickname ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link href="/perfil" className="muted">
                {t.profile}
              </Link>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.2)"
                }}
              >
                <Image src={avatarUrl ?? "/logo.png"} alt={nickname} width={28} height={28} style={{ objectFit: "cover" }} />
              </div>
              <span className="muted">{t.hello}, {nickname}</span>
              <button className="button secondary" type="button" onClick={handleSignOut}>
                {t.logout}
              </button>
            </div>
          ) : (
            <>
              <Link className="button secondary" href="/login">
                {t.login}
              </Link>
              <Link className="button" href="/register">
                {t.join}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
