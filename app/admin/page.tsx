"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { StatCard } from "@/components/StatCard";
import { AdminSyncYouTube } from "@/components/AdminSyncYouTube";

type Counts = {
  news: number;
  blogs: number;
  events: number;
  promotions: number;
  guestsNew: number;
  users: number;
};

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts>({
    news: 0,
    blogs: 0,
    events: 0,
    promotions: 0,
    guestsNew: 0,
    users: 0
  });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setStatus(null);
      const [newsR, blogsR, eventsR, promoR, guestR, usersR] = await Promise.all([
        supabase.from("news_items").select("*", { count: "exact", head: true }),
        supabase.from("blog_posts").select("*", { count: "exact", head: true }),
        supabase.from("live_events").select("*", { count: "exact", head: true }),
        supabase.from("promotions").select("*", { count: "exact", head: true }),
        supabase.from("guest_requests").select("*", { count: "exact", head: true }).eq("status", "new"),
        supabase.from("users").select("*", { count: "exact", head: true })
      ]);

      const error =
        newsR.error || blogsR.error || eventsR.error || promoR.error || guestR.error || usersR.error;
      if (error) {
        setStatus(error.message);
      }

      setCounts({
        news: newsR.count ?? 0,
        blogs: blogsR.count ?? 0,
        events: eventsR.count ?? 0,
        promotions: promoR.count ?? 0,
        guestsNew: guestR.count ?? 0,
        users: usersR.count ?? 0
      });
    };

    load();
  }, []);

  return (
    <main>
      <h1 className="section-title">Panel Admin</h1>
      <p className="muted">Centro de operaciones: homepage, contenido, eventos, promociones y comunidad.</p>
      {status ? (
        <div className="card" style={{ marginTop: 14 }}>
          <p className="muted" style={{ margin: 0 }}>{status}</p>
        </div>
      ) : null}
      <div className="admin-grid" style={{ marginTop: 20 }}>
        <StatCard label="Noticias" value={String(counts.news)} />
        <StatCard label="Blogs" value={String(counts.blogs)} />
        <StatCard label="Eventos" value={String(counts.events)} />
        <StatCard label="Promociones" value={String(counts.promotions)} />
        <StatCard label="Invitados (new)" value={String(counts.guestsNew)} />
        <StatCard label="Usuarios" value={String(counts.users)} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 28 }}>
        <div className="card">
          <h3>Editar Homepage</h3>
          <p className="muted">Texto principal, módulos visibles y estructura editorial del home.</p>
          <Link className="button" href="/admin/home">
            Configurar Home
          </Link>
        </div>
        <div className="card">
          <h3>Eventos y Promociones</h3>
          <p className="muted">Crear eventos en vivo y anuncios de marcas para homepage.</p>
          <div className="admin-item-actions">
            <Link className="button" href="/admin/events">
              Gestionar Eventos
            </Link>
            <Link className="button secondary" href="/admin/promotions">
              Gestionar Promociones
            </Link>
          </div>
        </div>
        <div className="card">
          <h3>Invitados al programa</h3>
          <p className="muted">Revisa solicitudes nuevas y mueve estado a contacted/closed.</p>
          <Link className="button secondary" href="/admin/guest-requests">
            Ver solicitudes
          </Link>
        </div>
        <AdminSyncYouTube />
      </div>
    </main>
  );
}
