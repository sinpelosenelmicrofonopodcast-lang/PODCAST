"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabaseClient";

export function Navbar() {
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;
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
      const hasAdmin = roles?.some((row) => row.roles?.name === "admin") ?? false;
      if (mounted) setIsAdmin(hasAdmin);
    };

    loadProfile();
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

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
          <Link href="/feed">Feed</Link>
          <Link href="/community">Comunidad</Link>
          <Link href="/foro">Foro</Link>
          <Link href="/noticias">Noticias</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/zona-cruda">Zona Cruda</Link>
          {isAdmin ? <Link href="/admin">Dashboard</Link> : null}
          {nickname ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link href="/perfil" className="muted">
                Mi perfil
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
              <span className="muted">Hola, {nickname}</span>
              <button className="button secondary" type="button" onClick={handleSignOut}>
                Salir
              </button>
            </div>
          ) : (
            <>
              <Link className="button secondary" href="/login">
                Ingresar
              </Link>
              <Link className="button" href="/register">
                Unirme
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
