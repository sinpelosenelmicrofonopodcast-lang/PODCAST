"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { LanguageToggle } from "@/components/LanguageToggle";
import { SocialBrandIcon } from "@/components/SocialBrandIcon";
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
        return;
      }
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        setIsAdmin(Boolean(json?.isAdmin));
        setIsStaff(Boolean(json?.isStaff));
        return;
      }
      setIsAdmin(false);
      setIsStaff(false);
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
      const target = e.target as Node | null;
      const inMenu = menuRef.current && target ? menuRef.current.contains(target) : false;
      const inCommunity = communityRef.current && target ? communityRef.current.contains(target) : false;
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
  const isPathActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const matchesAny = (hrefs: string[]) => hrefs.some((href) => isPathActive(href));
  const communityAreaActive = matchesAny(["/community", "/comunidad", "/foro", "/confesionario", "/teorias"]);
  const discoverAreaActive = matchesAny([
    "/feed",
    "/blog",
    "/musica",
    "/emprendimiento",
    "/eventos",
    "/rss",
    "/mic-brawl",
    "/publicidad",
    "/quiero-salir",
    "/terminos"
  ]);
  const communityLinks: { href: Route; label: string }[] = [
    { href: "/community", label: lang === "es" ? "Comunidad" : "Community" },
    { href: "/foro", label: t.forum },
    { href: "/confesionario", label: t.confessional },
    { href: "/teorias", label: t.theories }
  ];
  const discoverLinks: { href: Route; label: string }[] = [
    { href: "/acerca", label: lang === "es" ? "Conócenos" : "About us" },
    { href: "/blog", label: lang === "es" ? "Desde el Micrófono" : "From the Mic" },
    { href: "/feed", label: lang === "es" ? "Descubrir" : "Discover" },
    { href: "/eventos", label: t.events },
    { href: "/musica", label: t.music },
    { href: "/emprendimiento", label: t.entrepreneurship },
    { href: "/rss", label: "RSS / Audio" },
    { href: "/mic-brawl", label: "Mic Brawl" },
    { href: "/publicidad", label: t.ads },
    { href: "/quiero-salir", label: t.guest },
    { href: "/terminos", label: lang === "es" ? "Términos" : "Terms" }
  ];

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
        <Link className="brand" href="/" aria-label="Sin Pelos en el Micrófono — Inicio">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size={44} animated={false} />
            <span>Sin Pelos</span>
          </div>
        </Link>

        <div className="nav-mid">
          <div className={`nav-tabs${isOverlayOpen ? " is-overlay-open" : ""}`} role="navigation" aria-label="Navegación principal">
            <Link className={`nav-link${isPathActive("/") ? " active" : ""}`} href="/">{t.home}</Link>
            <Link className={`nav-link${isPathActive("/podcast") ? " active" : ""}`} href="/podcast">{t.podcast}</Link>
            <Link className={`nav-link${isPathActive("/noticias") ? " active" : ""}`} href="/noticias">{t.news}</Link>
            <Link className={`nav-link${isPathActive("/blog") ? " active" : ""}`} href="/blog">
              {lang === "es" ? "Desde el Micrófono" : "From the Mic"}
            </Link>

            <div className="nav-submenu" ref={communityRef}>
              <Link className={`nav-link${communityAreaActive ? " active" : ""}`} href="/community">{t.community}</Link>
              <button
                className={`nav-link nav-submenu-btn${communityAreaActive ? " active" : ""}`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={communityOpen}
                aria-label={`${t.community}: abrir submenú`}
                onClick={() => {
                  setCommunityOpen((value) => !value);
                  setMenuOpen(false);
                }}
              >
                ▾
              </button>
              {communityOpen ? (
                <div className="nav-menu-panel nav-menu-panel-left" role="menu" aria-label={`${t.community}: submenú`}>
                  {communityLinks.map((link) => (
                    <Link
                      key={link.href}
                      className={`nav-menu-link${isPathActive(link.href) ? " active" : ""}`}
                      role="menuitem"
                      href={link.href}
                      onClick={() => setCommunityOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>

            <Link className={`nav-link nav-link-raw${isPathActive("/zona-cruda") ? " active" : ""}`} href="/zona-cruda">{t.rawZone}</Link>

            <div className="nav-menu" ref={menuRef}>
              <button
                className={`nav-link nav-menu-btn${discoverAreaActive ? " active" : ""}`}
                type="button"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuOpen((value) => !value);
                  setCommunityOpen(false);
                }}
              >
                {t.menu}
              </button>
              {menuOpen ? (
                <div className="nav-menu-panel" role="menu">
                  {discoverLinks.map((link) => (
                    <Link
                      key={link.href}
                      className={`nav-menu-link${isPathActive(link.href) ? " active" : ""}`}
                      role="menuitem"
                      href={link.href}
                      onClick={() => setMenuOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  {isStaff ? (
                    <>
                      <div className="nav-menu-divider" role="separator" aria-hidden="true" />
                      <Link
                        className={`nav-menu-link${isPathActive("/admin") ? " active" : ""}`}
                        role="menuitem"
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                      >
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
              <Link href="/perfil" className="muted nav-profile-link">{t.profile}</Link>
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
              {isStaff ? <Link className="button secondary nav-admin-quick" href="/admin">{t.dashboard}</Link> : null}
              <button className="button secondary" type="button" onClick={handleSignOut}>{t.logout}</button>
            </div>
          ) : (
            <>
              <Link className="button secondary" href="/login">{t.login}</Link>
              <Link className="button" href="/register">{t.join}</Link>
            </>
          )}
        </div>
      </div>

      <TopBannerPromo />
      <div className="social-strip" role="complementary" aria-label="Redes sociales oficiales">
        <div className="container social-strip-inner">
          <span className="social-strip-label">Síguenos:</span>
          <a className="social-strip-link" href="https://www.facebook.com/sinpelosenelmicrofono" target="_blank" rel="noreferrer" aria-label="Facebook Sin Pelos en el Micrófono">
            <SocialBrandIcon network="facebook" /><span>Facebook</span>
          </a>
          <a className="social-strip-link" href="https://www.instagram.com/sinpelosenelmicrofono" target="_blank" rel="noreferrer" aria-label="Instagram Sin Pelos en el Micrófono">
            <SocialBrandIcon network="instagram" /><span>Instagram</span>
          </a>
          <a className="social-strip-link" href="https://www.tiktok.com/@sinpelosenelmicrofono" target="_blank" rel="noreferrer" aria-label="TikTok Sin Pelos en el Micrófono">
            <SocialBrandIcon network="tiktok" /><span>TikTok</span>
          </a>
          <a className="social-strip-link" href="https://www.youtube.com/@SinPelosEnElMicrofono" target="_blank" rel="noreferrer" aria-label="YouTube Sin Pelos en el Micrófono">
            <SocialBrandIcon network="youtube" /><span>YouTube</span>
          </a>
        </div>
      </div>
    </nav>
  );
}
