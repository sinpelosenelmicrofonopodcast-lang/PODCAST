"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";

type Subscriber = {
  id: string;
  email: string;
  status: "active" | "unsubscribed" | "bounced" | string;
  source_path: string | null;
  preferred_language: string | null;
  subscribed_at: string;
};

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("es-PR", { year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminNewsletterPage() {
  const [items, setItems] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "unsubscribed" | "bounced">("all");

  const load = async () => {
    setLoading(true);
    const primary = await supabase
      .from("newsletter_subscribers")
      .select("id, email, status, source_path, preferred_language, subscribed_at")
      .order("subscribed_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (primary.error) {
      toast.error(primary.error.message);
      setItems([]);
      return;
    }
    setItems((primary.data as any) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (!needle) return true;
      return s.email.toLowerCase().includes(needle) || String(s.source_path ?? "").toLowerCase().includes(needle);
    });
  }, [items, q, status]);

  const updateStatus = async (id: string, next: Subscriber["status"]) => {
    const { error } = await supabase
      .from("newsletter_subscribers")
      .update({ status: next, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Actualizado.");
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, status: next } : s)));
  };

  const exportCsv = () => {
    const rows = filtered.map((s) => ({
      email: s.email,
      status: s.status,
      subscribed_at: s.subscribed_at,
      preferred_language: s.preferred_language ?? "",
      source_path: s.source_path ?? ""
    }));
    const header = Object.keys(rows[0] ?? { email: "", status: "", subscribed_at: "", preferred_language: "", source_path: "" });
    const esc = (v: any) => `"${String(v ?? "").replace(/\"/g, '""')}"`;
    const csv = [header.join(","), ...rows.map((r) => header.map((k) => esc((r as any)[k])).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "newsletter_subscribers.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <main>
      <h1 className="section-title">Newsletter</h1>
      <p className="muted">Leads capturados desde el blog. Exporta CSV para Mailchimp/Sendgrid.</p>

      <div className="card form-stack" style={{ marginTop: 18 }}>
        <label>
          Buscar
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="email o /ruta" />
        </label>
        <label>
          Estado
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="all">Todos</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
            <option value="bounced">Bounced</option>
          </select>
        </label>
        <div className="form-submit-bar">
          <button className="button" type="button" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Recargar"}
          </button>
          <button className="button secondary" type="button" onClick={exportCsv} disabled={filtered.length === 0}>
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="muted" style={{ fontSize: 12 }}>
          Total: {filtered.length}
        </div>
        <div className="list" style={{ marginTop: 12 }}>
          {filtered.map((s) => (
            <div key={s.id} className="card" style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{s.email}</strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  {formatDate(s.subscribed_at)}
                </span>
              </div>
              <div className="muted" style={{ fontSize: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <span>Status: {s.status}</span>
                {s.preferred_language ? <span>Lang: {s.preferred_language}</span> : null}
                {s.source_path ? <span>Source: {s.source_path}</span> : null}
              </div>
              <div className="admin-item-actions">
                <button className="button secondary" type="button" onClick={() => updateStatus(s.id, "active")}>
                  Marcar active
                </button>
                <button className="button secondary" type="button" onClick={() => updateStatus(s.id, "unsubscribed")}>
                  Unsubscribe
                </button>
                <button className="button secondary" type="button" onClick={() => updateStatus(s.id, "bounced")}>
                  Bounced
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 ? <p className="muted">Sin registros.</p> : null}
        </div>
      </div>
    </main>
  );
}

