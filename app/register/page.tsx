"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Navbar } from "@/components/Navbar";
import { Logo } from "@/components/Logo";

export default function RegisterPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [confirm21, setConfirm21] = useState(false);
  const [legalAck, setLegalAck] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const normalizeNickname = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

  const computeAge = (dateValue: string) => {
    const birth = new Date(dateValue);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age;
  };

  const handleRegister = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);

    if (!confirm21 || !legalAck) {
      setStatus("Debes certificar 21+ y aceptar Términos y Condiciones para registrarte.");
      return;
    }

    if (!birthDate || computeAge(birthDate) < 21) {
      setStatus("El registro está limitado a usuarios de 21 años o más.");
      return;
    }

    const safeNickname = normalizeNickname(nickname);

    if (safeNickname.length < 3) {
      setStatus("El nickname debe tener al menos 3 caracteres (letras, números o _).");
      return;
    }

    const nicknameCheck = await supabase.from("users").select("id").ilike("nickname", safeNickname).limit(1);
    if (nicknameCheck.error) {
      setStatus(`No se pudo validar nickname: ${nicknameCheck.error.message}`);
      return;
    }
    if ((nicknameCheck.data ?? []).length > 0) {
      setStatus("Ese nickname ya está en uso. Elige otro.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          nickname: safeNickname,
          birth_date: birthDate,
          is_21_confirmed: confirm21,
          legal_ack_at: new Date().toISOString(),
          terms_accepted: true
        }
      }
    });

    if (error) {
      if (error.message.toLowerCase().includes("database error saving new user")) {
        setStatus(
          "Registro bloqueado por configuración de base de datos (trigger en auth.users). Ejecuta la migración `supabase/fix_auth_signup_triggers.sql` en Supabase SQL Editor y vuelve a intentar."
        );
        return;
      }
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
              Nombre real
              <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </label>
            <label>
              Apellido real
              <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </label>
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
              Acepto los{" "}
              <Link href="/terminos" target="_blank">
                Términos y Condiciones
              </Link>
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
