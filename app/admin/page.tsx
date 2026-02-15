import Link from "next/link";
import { StatCard } from "@/components/StatCard";
import { AdminSyncYouTube } from "@/components/AdminSyncYouTube";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboard() {
  const supabase = supabaseServer();
  const [
    { count: newsCount },
    { count: blogCount },
    { count: eventsCount },
    { count: promotionsCount },
    { count: guestCount }
  ] = await Promise.all([
    supabase.from("news_items").select("*", { count: "exact", head: true }),
    supabase.from("blog_posts").select("*", { count: "exact", head: true }),
    supabase.from("live_events").select("*", { count: "exact", head: true }),
    supabase.from("promotions").select("*", { count: "exact", head: true }),
    supabase.from("guest_requests").select("*", { count: "exact", head: true }).eq("status", "new")
  ]);

  return (
    <main>
      <h1 className="section-title">Panel Admin</h1>
      <p className="muted">Centro de operaciones: homepage, contenido, eventos, promociones y comunidad.</p>
      <div className="admin-grid" style={{ marginTop: 20 }}>
        <StatCard label="Noticias" value={String(newsCount ?? 0)} />
        <StatCard label="Blogs" value={String(blogCount ?? 0)} />
        <StatCard label="Eventos" value={String(eventsCount ?? 0)} />
        <StatCard label="Promociones" value={String(promotionsCount ?? 0)} />
        <StatCard label="Invitados (new)" value={String(guestCount ?? 0)} />
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
