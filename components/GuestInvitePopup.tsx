"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "sinpelos_guest_popup_closed";

export function GuestInvitePopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const closed = window.localStorage.getItem(STORAGE_KEY);
    if (!closed) {
      const timer = window.setTimeout(() => setOpen(true), 500);
      return () => window.clearTimeout(timer);
    }
  }, []);

  const close = () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="guest-popup-backdrop" role="dialog" aria-modal="true" aria-label="Invitacion para salir en Sin Pelos">
      <div className="guest-popup-card">
        <span className="badge">Invitado especial</span>
        <h3>Quieres salir en Sin Pelos?</h3>
        <p className="muted">
          Cuéntanos tu disponibilidad y el tema que quieres traer. Si encaja con la línea editorial, te contactamos.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="button" href="/quiero-salir" onClick={close}>
            Quiero salir en Sin Pelos
          </Link>
          <button className="button secondary" type="button" onClick={close}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

