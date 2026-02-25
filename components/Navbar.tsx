"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { TopBannerPromo } from "@/components/promotions/TopBannerPromo";
import type { Session } from "@supabase/supabase-js";
import { navTexts } from "@/lib/i18n";
import { APP_LANG_EVENT, readStoredLang, type AppLang } from "@/lib/language";
import { supabase } from "@/lib/supabaseClient";

async function syncServerSession(session: Session | null) {
  if (session?.access_token && session.refresh_token) {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresIn: session.expires_in
      })
    }).catch(() => null);
    return;
  }
  await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
}

export function Navbar() {
  const pathname = usePathname() ?? "/";
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string>("/logo.png");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
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
          setIsStaff(false);
        }
        return;
      }

      const { data: profile } = await supabase.from("users").select("nickname, avatar_url").eq("id", userId).single();
      if (mounted && profile?.nickname) setNickname(profile.nickname);
      if (mounted) setAvatarUrl(profile?.avatar_url ?? null);

      // Admin check must NOT rely on client-side RLS (can fail and hide admin UI).
      // We validate via server route that uses service role for role lookup.
      const { data: sessionData } = await supabase.auth.getSession();
      await syncServerSession(sessionData.session ?? null);
      const token = sessionData.session?.access_token;
      if (!token) {
        if (mounted) {
          setIsAdmin(false);
          setIsStaff(false);
        }
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
        const json = await res.json().catch(() => ({}));
        setIsAdmin(Boolean(json?.isAdmin));
        setIsStaff(Boolean(json?.isStaff));
        setAdminCheckError(null);
        return;
      }
      if (res.status === 403) {
        setIsAdmin(false);
        setIsStaff(false);
        setAdminCheckError(null);
        return;
      }
      const json = await res.json().catch(() => ({}));
      setIsAdmin(false);
      setIsStaff(false);
      setAdminCheckError(json?.error ?? `No se pudo verificar permisos (HTTP ${res.status}).`);
    };

    loadProfile();
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await syncServerSession(session);
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
    setAvatarSrc(avatarUrl || "/logo.png");
  }, [avatarUrl]);

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
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null);
    setNickname(null);
    setAvatarUrl(null);
    setIsAdmin(false);
    setIsStaff(false);
  };

  const isOverlayOpen = menuOpen || communityOpen;

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
          <div className={`nav-tabs${isOverlayOpen ? " is-overlay-open" : ""}`} role="navigation" aria-label="Navegación principal">
            <Link className="nav-link" href="/">{t.home}</Link>
            <Link className="nav-link" href="/noticias">{t.news}</Link>
            <Link className="nav-link" href="/podcast">{t.podcast}</Link>

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
                  <Link className="nav-menu-link" role="menuitem" href="/musica" onClick={() => setMenuOpen(false)}>
                    {t.music}
                  </Link>
                  <Link className="nav-menu-link" role="menuitem" href="/emprendimiento" onClick={() => setMenuOpen(false)}>
                    {t.entrepreneurship}
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
                  {isStaff ? (
                    <>
                      <div className="nav-menu-divider" role="separator" aria-hidden="true" />
                      <Link className="nav-menu-link" role="menuitem" href="/admin" onClick={() => setMenuOpen(false)}>
                        {t.dashboard}
                      </Link>
                    </>
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
              <Link href="/perfil" className="muted nav-profile-link">
                {t.profile}
              </Link>
              <div className="nav-avatar">
                <img
                  src={avatarSrc}
                  alt={nickname}
                  width={28}
                  height={28}
                  loading="lazy"
                  decoding="async"
                  onError={() => setAvatarSrc("/logo.png")}
                />
              </div>
              <span className="muted nav-hello">{t.hello}, {nickname}</span>
              {isStaff ? (
                <Link className="button secondary nav-admin-quick" href="/admin">
                  {t.dashboard}
                </Link>
              ) : null}
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
      <div className="social-strip" role="complementary" aria-label="Redes sociales oficiales">
        <div className="container social-strip-inner">
          <span className="social-strip-label">Síguenos:</span>
          <a
            className="social-strip-link"
            href="https://www.facebook.com/sinpelosenelmicrofono"
            target="_blank"
            rel="noreferrer"
            aria-label="Facebook Sin Pelos en el Micrófono"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M13 9h3V6h-3c-2.21 0-4 1.79-4 4v2H7v3h2v6h3v-6h3l1-3h-4v-2c0-.55.45-1 1-1Z" fill="currentColor" />
            </svg>
            Facebook
          </a>
          <a
            className="social-strip-link"
            href="https://www.instagram.com/sinpelosenelmicrofono"
            target="_blank"
            rel="noreferrer"
            aria-label="Instagram Sin Pelos en el Micrófono"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm8.5 2h-8.5A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-2.75a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z"
                fill="currentColor"
              />
            </svg>
            Instagram
          </a>
          <a
            className="social-strip-link"
            href="https://www.tiktok.com/@sinpelosenelmicrofono"
            target="_blank"
            rel="noreferrer"
            aria-label="TikTok Sin Pelos en el Micrófono"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M14 3h2.2c.3 1.8 1.7 3.2 3.5 3.5V9c-1.3 0-2.5-.4-3.5-1.1V15a6 6 0 1 1-6-6c.3 0 .5 0 .8.1v2.4a3.6 3.6 0 1 0 2.9 3.5V3Z"
                fill="currentColor"
              />
            </svg>
            TikTok
          </a>
          <a
            className="social-strip-link"
            href="https://www.youtube.com/@SinPelosEnElMicrofono"
            target="_blank"
            rel="noreferrer"
            aria-label="YouTube Sin Pelos en el Micrófono"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path
                d="M22 12c0 2.5-.3 4.3-.6 5.3-.3.8-1 1.5-1.8 1.8-1 .3-3 .6-7.6.6s-6.6-.3-7.6-.6c-.8-.3-1.5-1-1.8-1.8C2.3 16.3 2 14.5 2 12s.3-4.3.6-5.3c.3-.8 1-1.5 1.8-1.8 1-.3 3-.6 7.6-.6s6.6.3 7.6.6c.8.3 1.5 1 1.8 1.8.3 1 .6 2.8.6 5.3Zm-12-3.5v7l6-3.5-6-3.5Z"
                fill="currentColor"
              />
            </svg>
            YouTube
          </a>
        </div>
      </div>
    </nav>
  );
}
