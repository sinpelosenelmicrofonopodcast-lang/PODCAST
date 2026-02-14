"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";

export default function ResetPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const initSession = async () => {
      setStatus(null);
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const hash = url.hash.startsWith("#") ? url.hash.substring(1) : "";
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            setStatus(error.message);
            return;
          }
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) {
            setStatus(error.message);
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setStatus("El enlace expiró o ya fue usado. Solicita uno nuevo.");
          return;
        }
        setReady(true);
      } catch (error) {
        setStatus("No pudimos validar el enlace. Solicita uno nuevo.");
      }
    };

    initSession();
  }, []);

  const handleReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    if (password.length < 8) {
      setStatus("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setStatus("Las contraseñas no coinciden.");
      return;
    }
    if (!ready) {
      setStatus("Validando enlace, espera un momento...");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus(error.message);
      return;
    }
    setStatus("Contraseña actualizada. Redirigiendo al login...");
    router.push("/login");
  };

  return (
    <main className="app-enter">
      <Navbar />
      <section className="section">
        <div className="container" style={{ maxWidth: 480 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <Logo size={96} animated />
          </div>
          <h1 className="section-title" style={{ textAlign: "center" }}>
            Restablecer contraseña
          </h1>
          <form className="card" onSubmit={handleReset}>
            <label>
              Nueva contraseña
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            <label>
              Confirmar contraseña
              <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            </label>
            <button className="button" type="submit" disabled={!ready}>
              Actualizar contraseña
            </button>
            {status ? <p className="muted">{status}</p> : null}
          </form>
        </div>
      </section>
    </main>
  );
}
