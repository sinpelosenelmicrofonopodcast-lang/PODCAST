import { requireStaffPageOrRedirect } from "@/lib/adminAuth";
import { supabaseService } from "@/lib/supabaseService";

export default async function AdminNewsEngineSettingsPage() {
  await requireStaffPageOrRedirect("/admin/news-engine/settings", "manage_news_sources");
  const service = supabaseService();

  const { data, error } = await service
    .from("admin_settings")
    .select("id,key,value,updated_at")
    .order("key", { ascending: true });

  return (
    <main>
      <h1 className="section-title">News Engine · Settings</h1>
      <p className="muted">Configuración central (scoring, tono editorial, cron intervals, push thresholds).</p>
      {error ? <div className="card"><p className="muted">{error.message}</p></div> : null}
      <div className="list" style={{ marginTop: 14 }}>
        {(data ?? []).map((item: any) => (
          <article key={item.id} className="card" style={{ display: "grid", gap: 8 }}>
            <strong>{item.key}</strong>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 12 }}>{JSON.stringify(item.value ?? {}, null, 2)}</pre>
            <p className="muted" style={{ margin: 0 }}>{new Date(item.updated_at).toLocaleString("es-PR")}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
