import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";
import { ConfessionModerationActions } from "@/components/admin/ConfessionModerationActions";

export default async function AdminConfessionsPage() {
  await requireStaffPageOrRedirect("/admin/confessions", "moderate_confessions");
  const service = supabaseService();

  const { data, error } = await service
    .from("confessions")
    .select("id, title, body, status, category, region, is_anonymous, created_at")
    .order("created_at", { ascending: false })
    .limit(80);

  return (
    <main>
      <h1 className="section-title">Moderación de Confesiones</h1>
      <p className="muted">Revisa pendientes y cambia estado a approved/rejected/published.</p>
      {error ? <div className="card"><p className="muted">{error.message}</p></div> : null}

      <div className="list" style={{ marginTop: 14 }}>
        {(data ?? []).map((item: any) => (
          <article key={item.id} className="card" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <strong>{item.title ?? "Sin título"}</strong>
              <span className="news-badge">{item.status}</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>{item.body}</p>
            <p className="muted" style={{ margin: 0 }}>
              {item.category ?? "—"} · {item.region ?? "—"} · {item.is_anonymous ? "anónimo" : "no anónimo"} · {new Date(item.created_at).toLocaleString("es-PR")}
            </p>
            <ConfessionModerationActions confessionId={item.id} />
          </article>
        ))}
      </div>
    </main>
  );
}
