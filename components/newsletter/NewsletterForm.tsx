"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "@/lib/toast";
import { readStoredLang } from "@/lib/language";

function isEmail(value: string) {
  const v = String(value ?? "").trim();
  if (v.length < 6 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function NewsletterForm({
  variant = "sidebar",
  title = "Suscribete",
  subtitle = "Sin spam. Solo lo que vale."
}: {
  variant?: "sidebar" | "cta";
  title?: string;
  subtitle?: string;
}) {
  const pathname = usePathname() ?? "/";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!isEmail(value)) return toast.error("Escribe un email valido.");

    setLoading(true);
    const preferredLanguage = readStoredLang() ?? "es";
    const res = await fetch("/api/newsletter/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: value, sourcePath: pathname, preferredLanguage })
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    setLoading(false);

    if (!res?.ok || !json?.ok) {
      toast.error(json?.error ?? "No se pudo suscribir.");
      return;
    }

    toast.success("Listo. Estas suscrito.");
    setEmail("");
  };

  return (
    <div className={variant === "cta" ? "newsletter-cta card" : "newsletter card"}>
      <div className="sidebar-title">{title}</div>
      <p className="muted" style={{ marginTop: 8 }}>
        {subtitle}
      </p>
      <form className="newsletter-form" onSubmit={onSubmit}>
        <input
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Tu email"
          inputMode="email"
          autoComplete="email"
        />
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Enviando..." : "Suscribirme"}
        </button>
      </form>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Al suscribirte aceptas recibir emails de Sin Pelos.
      </p>
    </div>
  );
}

