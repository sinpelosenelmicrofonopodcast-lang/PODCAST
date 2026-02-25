"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function AdminWall() {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setError(null);
      const { data: userData } = await supabase.auth.getUser();
      if (!mounted) return;

      if (!userData.user) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/admin")}`);
        return;
      }

      const res = await fetch("/api/admin/me", { headers: { Authorization: `Bearer ${token}` } });
      if (!mounted) return;
      if (!res.ok) {
        if (res.status === 403) {
          router.replace("/");
          return;
        }
        // 500/401/etc: show a clear error instead of silently kicking admins out.
        const json = await res.json().catch(() => ({}));
        setError(json?.error ?? `No se pudo verificar permisos (HTTP ${res.status}).`);
        setChecking(false);
        return;
      }

      setChecking(false);
    };
    run();
    return () => {
      mounted = false;
    };
  }, [pathname, router]);

  if (!checking) {
    if (!error) return null;
    return (
      <div className="auth-wall">
        <div className="card auth-wall-card">
          <h3 style={{ margin: 0 }}>No se pudo validar acceso</h3>
          <p className="muted" style={{ margin: 0 }}>
            {error}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="button secondary" type="button" onClick={() => window.location.reload()}>
              Reintentar
            </button>
            <button className="button" type="button" onClick={() => router.replace("/")}>
              Volver al Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wall">
      <div className="card auth-wall-card">
        <h3 style={{ margin: 0 }}>Verificando permisos…</h3>
        <p className="muted" style={{ margin: 0 }}>
          Si no tienes acceso al panel, serás redirigido automáticamente.
        </p>
      </div>
    </div>
  );
}
