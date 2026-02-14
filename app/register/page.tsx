"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [confirm21, setConfirm21] = useState(false);
  const [legalAck, setLegalAck] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (!confirm21 || !legalAck) {
      setStatus("Debes certificar que tienes 21+ y aceptar términos de contenido adulto.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nickname,
          birth_date: birthDate,
          is_21_confirmed: confirm21
        }
      }
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus("Registro creado. Revisa tu email si se requiere confirmación.");
  };

  return (
    <main className="app-enter">
      <Navbar />
      <section className="section form-screen">
        <div className="container form-container">
          <div className="form-logo-wrap">
            <Logo size={96} animated />
          </div>
          <h1 className="section-title form-title-center">
            Crear cuenta
          </h1>
          <form className="card form-stack" onSubmit={handleRegister}>
            <label>
              Nickname único
              <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
            </label>
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
            <label>
              Fecha de nacimiento
              <input className="input" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
            </label>
            <label className="check-row">
              <input type="checkbox" checked={confirm21} onChange={(e) => setConfirm21(e.target.checked)} />
              Certifico que tengo 21 años o más
            </label>
            <label className="check-row">
              <input type="checkbox" checked={legalAck} onChange={(e) => setLegalAck(e.target.checked)} />
              Acepto términos de contenido adulto y lenguaje fuerte
            </label>
            {status ? <p className="muted" style={{ margin: 0 }}>{status}</p> : null}
            <div className="form-submit-bar">
              <button className="button form-submit" type="submit">
                Crear cuenta
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
