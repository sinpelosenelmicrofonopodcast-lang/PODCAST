"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function AuthWall() {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!data.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
        return;
      }
      const { data: profile } = await supabase
        .from("users")
        .select("user_status")
        .eq("id", data.user.id)
        .single();
      if (profile?.user_status === "blocked") {
        await supabase.auth.signOut();
        router.replace("/login?blocked=1");
        return;
      }
      setChecking(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!checking) return null;

  return (
    <div className="auth-wall">
      <div className="card auth-wall-card">
        <h3 style={{ margin: 0 }}>Acceso solo para usuarios registrados (21+)</h3>
        <p className="muted" style={{ margin: 0 }}>
          Verificando sesión...
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="button secondary" href="/login">
            Entrar
          </Link>
          <Link className="button" href="/register">
            Registrarme
          </Link>
        </div>
      </div>
    </div>
  );
}
