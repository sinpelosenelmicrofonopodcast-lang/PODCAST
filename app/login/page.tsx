"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [resetStatus, setResetStatus] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setStatus(error.message);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
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
    }
    setStatus("Ingreso exitoso. Redirigiendo al feed...");
    router.push("/feed");
  };

  const handleReset = async () => {
    setResetStatus(null);
    if (!email) {
      setResetStatus("Ingresa tu email para enviarte el enlace.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`
    });
    if (error) {
      setResetStatus(error.message);
      return;
    }
    setResetStatus("Te enviamos un enlace para restablecer tu contraseña.");
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
            Ingresar
          </h1>
          <form className="card" onSubmit={handleLogin}>
            <label>
              Email
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Contraseña
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <button className="button" type="submit">
              Entrar
            </button>
            {status ? <p className="muted">{status}</p> : null}
            <button className="button secondary" type="button" onClick={handleReset}>
              Olvidé mi contraseña
            </button>
            {resetStatus ? <p className="muted">{resetStatus}</p> : null}
          </form>
        </div>
      </section>
    </main>
  );
}
