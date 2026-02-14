import { StatCard } from "@/components/StatCard";
import { AdminSyncYouTube } from "@/components/AdminSyncYouTube";

export default function AdminDashboard() {
  return (
    <main>
      <h1 className="section-title">Panel Admin</h1>
      <p className="muted">Centro de operaciones: publicar, moderar, programar y medir.</p>
      <div className="admin-grid" style={{ marginTop: 20 }}>
        <StatCard label="Posts publicados" value="128" />
        <StatCard label="Reportes abiertos" value="7" />
        <StatCard label="Miembros pagos" value="2,403" />
        <StatCard label="Eventos próximos" value="3" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginTop: 28 }}>
        <div className="card">
          <h3>Publicación rápida</h3>
          <p className="muted">Sube contenido y selecciona redes en segundos.</p>
          <button className="button" type="button">
            Crear nuevo post
          </button>
        </div>
        <div className="card">
          <h3>Moderación legal</h3>
          <p className="muted">Revisión de reportes, doxxing y amenazas.</p>
          <button className="button secondary" type="button">
            Ver reportes
          </button>
        </div>
        <AdminSyncYouTube />
      </div>
    </main>
  );
}
