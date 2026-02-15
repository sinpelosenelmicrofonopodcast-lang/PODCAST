"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/lib/toast";

export function AdminDeleteButton({ table, id, label = "Eliminar" }: { table: string; id: string; label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este contenido?")) return;
    setLoading(true);
    setError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setError("No hay sesión activa. Inicia sesión como admin.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      console.error("Delete error:", error);
      setError(error.message);
      toast.error(error.message);
    } else {
      toast.success("Eliminado.");
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button className="button secondary" type="button" onClick={handleDelete} disabled={loading}>
        {loading ? "Eliminando..." : label}
      </button>
      {error ? <span className="muted" style={{ fontSize: 12 }}>{error}</span> : null}
    </div>
  );
}
