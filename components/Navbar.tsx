"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { TopBannerPromo } from "@/components/promotions/TopBannerPromo";
import { navTexts } from "@/lib/i18n";
import { APP_LANG_EVENT, readStoredLang, type AppLang } from "@/lib/language";
import { supabase } from "@/lib/supabaseClient";

export function Navbar() {
  const pathname = usePathname() ?? "/";
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckError, setAdminCheckError] = useState<string | null>(null);
  const [lang, setLang] = useState<AppLang>("es");
  const [menuOpen, setMenuOpen] = useState(false);
  const [communityOpen, setCommunityOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const communityRef = useRef<HTMLDivElement | null>(null);

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
      if (!userId) {
        if (mounted) {
          setNickname(null);
          setAvatarUrl(null);
          setIsAdmin(false);
        }
        return;
      }

      const { data: profile } = await supabase.from("users").select("nickname, avatar_url").eq("id", userId).single();
      if (mounted && profile?.nickname) setNickname(profile.nickname);
      if (mounted) setAvatarUrl(profile?.avatar_url ?? null);

      // Admin check must NOT rely on client-side RLS (can fail and hide admin UI).
      // We validate via server route that uses service role for role lookup.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        if (mounted) setIsAdmin(false);
        return;
      }
      const res = await fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (!mounted) return;
      if (!res) {
        setIsAdmin(false);
        setAdminCheckError("No se pudo verificar permisos (sin conexión).");
        return;
      }
      if (res.ok) {
        setIsAdmin(true);
        setAdminCheckError(null);
        return;
      }
      if (res.status === 403) {
        setIsAdmin(false);
        setAdminCheckError(null);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setIsAdmin(false);
      setAdminCheckError(json?.error ?? `No se pudo verificar permisos (HTTP ${res.status}).`);
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

  // UX: close dropdowns on outside click + ESC, and when route changes.
  useEffect(() => {
    setMenuOpen(false);
    setCommunityOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMenuOpen(false);
      setCommunityOpen(false);
    };
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node | null;
      const inMenu = menuRef.current && t ? menuRef.current.contains(t) : false;
      const inCommunity = communityRef.current && t ? communityRef.current.contains(t) : false;
      if (inMenu || inCommunity) return;
      setMenuOpen(false);
      setCommunityOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown as any, { passive: true } as any);
    window.addEventListener("touchstart", onPointerDown as any, { passive: true } as any);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown as any);
      window.removeEventListener("touchstart", onPointerDown as any);
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

            <div className="nav-submenu" ref={communityRef}>
              <Link className="nav-link" href="/community">
                {t.community}
              </Link>
              <button
                className="nav-link nav-submenu-btn"
                type="button"
                aria-haspopup="menu"
                aria-expanded={communityOpen}
                aria-label={`${t.community}: abrir submenú`}
                onClick={() => {
                  setCommunityOpen((v) => !v);
                  setMenuOpen(false);
                }}
              >
                ▾
              </button>
              {communityOpen ? (
                <div className="nav-menu-panel nav-menu-panel-left" role="menu" aria-label={`${t.community}: submenú`}>
                  <Link className="nav-menu-link" role="menuitem" href="/foro" onClick={() => setCommunityOpen(false)}>
                    {t.forum}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/confesionario" onClick={() => setCommunityOpen(false)}>
                    {t.confessional}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/teorias" onClick={() => setCommunityOpen(false)}>
                    {t.theories}
                  </Link>
                </div>
              ) : null}
            </div>

            <Link className="nav-link nav-link-raw" href="/zona-cruda">{t.rawZone}</Link>

            <div className="nav-menu" ref={menuRef}>
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
                  <Link className="nav-menu-link" role="menuitem" href="/feed?view=episodes" onClick={() => setMenuOpen(false)}>
                    {t.podcast}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/confesiones" onClick={() => setMenuOpen(false)}>
                    Confesiones
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/eventos" onClick={() => setMenuOpen(false)}>
                    {t.events}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/rss" onClick={() => setMenuOpen(false)}>
                    RSS (Audio)
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
