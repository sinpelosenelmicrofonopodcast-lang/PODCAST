"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { TopBannerPromo } from "@/components/promotions/TopBannerPromo";
import { navTexts } from "@/lib/i18n";
import { APP_LANG_EVENT, readStoredLang, type AppLang } from "@/lib/language";
import { supabase } from "@/lib/supabaseClient";

export function Navbar() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckError, setAdminCheckError] = useState<string | null>(null);
  const [lang, setLang] = useState<AppLang>("es");
  const [menuOpen, setMenuOpen] = useState(false);

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
      if (mounted) setAdminCheckError(null);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { data: profile } = await supabase.from("users").select("nickname, avatar_url").eq("id", userId).single();
      if (mounted && profile?.nickname) setNickname(profile.nickname);
      if (mounted) setAvatarUrl(profile?.avatar_url ?? null);

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("roles(name)")
        .eq("user_id", userId);
      if (mounted && rolesError) setAdminCheckError(rolesError.message);
      const hasAdmin =
        roles?.some((row: any) => {
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
        <div className="nav-mid">
          <div className="nav-tabs" role="navigation" aria-label="Navegación principal">
            <Link className="nav-link" href="/feed">{t.feed}</Link>
            <Link className="nav-link" href="/noticias">{t.news}</Link>
            <Link className="nav-link" href="/podcast">{t.podcast}</Link>
            <Link className="nav-link" href="/community">{t.community}</Link>
            <Link className="nav-link nav-link-raw" href="/zona-cruda">{t.rawZone}</Link>

            <div className="nav-menu">
              <button
                className="nav-link nav-menu-btn"
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {t.menu}
              </button>
              {menuOpen ? (
                <div className="nav-menu-panel" role="menu">
                  <Link className="nav-menu-link" role="menuitem" href="/blog" onClick={() => setMenuOpen(false)}>
                    {t.blog}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/foro" onClick={() => setMenuOpen(false)}>
                    {t.forum}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/confesionario" onClick={() => setMenuOpen(false)}>
                    {t.confessional}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/confesiones" onClick={() => setMenuOpen(false)}>
                    Confesiones
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/teorias" onClick={() => setMenuOpen(false)}>
                    {t.theories}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/eventos" onClick={() => setMenuOpen(false)}>
                    {t.events}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/publicidad" onClick={() => setMenuOpen(false)}>
                    {t.ads}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/quiero-salir" onClick={() => setMenuOpen(false)}>
                    {t.guest}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/terminos" onClick={() => setMenuOpen(false)}>
                    Términos
                  </Link>
                  {isAdmin ? (
                    <>
                      <div className="nav-menu-divider" role="separator" aria-hidden="true" />
                      <Link className="nav-menu-link" role="menuitem" href="/admin" onClick={() => setMenuOpen(false)}>
                        {t.dashboard}
                      </Link>
                    </>
                  ) : null}
                  {!isAdmin && adminCheckError ? (
                    <p className="muted" style={{ margin: "6px 10px 0", fontSize: 11 }} title={adminCheckError}>
                      Admin: no se pudo verificar permisos.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="nav-right">
          <LanguageToggle />
          {nickname ? (
            <div className="nav-user">
              <Link href="/perfil" className="muted">
                {t.profile}
              </Link>
              <div className="nav-avatar">
                <Image src={avatarUrl ?? "/logo.png"} alt={nickname} width={28} height={28} style={{ objectFit: "cover" }} />
              </div>
              <span className="muted nav-hello">{t.hello}, {nickname}</span>
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
      <TopBannerPromo />
    </nav>
  );
}
