"use client";

import { useEffect, useMemo, useState } from "react";
import { authApiRequest } from "@/lib/clientApi";
import { publishEditorialToFacebook, publishEditorialToInstagram } from "@/lib/editorialAdminClient";
import { toast } from "@/lib/toast";

type ContentType = "news" | "blog" | "episode";
type Destination = "facebook" | "instagram_feed" | "instagram_story";

type SearchItem = {
  id: string;
  type: ContentType;
  slug: string | null;
  title: string;
  text: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  publishedAt: string | null;
};

type ContentPayload = {
  ok: boolean;
  items: SearchItem[];
  error?: string;
};

type Props = {
  canManageNews: boolean;
  canManageBlog: boolean;
};

function destinationsFor(type: ContentType): Array<{ value: Destination; label: string }> {
  if (type === "episode") return [{ value: "facebook", label: "Facebook" }];
  return [
    { value: "facebook", label: "Facebook" },
    { value: "instagram_feed", label: "Instagram Feed" },
    { value: "instagram_story", label: "Instagram Story" }
  ];
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("es-PR");
}

export function AdminSocialHub({ canManageNews, canManageBlog }: Props) {
  const availableTypes = useMemo<ContentType[]>(() => {
    const values: ContentType[] = [];
    if (canManageNews) values.push("news", "episode");
    if (canManageBlog) values.push("blog");
    return values;
  }, [canManageBlog, canManageNews]);

  const [contentType, setContentType] = useState<ContentType>(availableTypes[0] ?? "news");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [selected, setSelected] = useState<SearchItem | null>(null);
  const [destination, setDestination] = useState<Destination>("facebook");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const destinationOptions = useMemo(() => destinationsFor(contentType), [contentType]);

  useEffect(() => {
    if (!availableTypes.includes(contentType) && availableTypes[0]) {
      setContentType(availableTypes[0]);
    }
  }, [availableTypes, contentType]);

  useEffect(() => {
    if (!destinationOptions.some((option) => option.value === destination)) {
      setDestination(destinationOptions[0]?.value ?? "facebook");
    }
  }, [destination, destinationOptions]);

  const loadContent = async () => {
    if (availableTypes.length === 0) return;
    setLoading(true);
    setStatus(null);
    const params = new URLSearchParams({ q: query.trim(), type: contentType, limit: "24" });
    const { ok, json } = await authApiRequest<ContentPayload>(`/api/admin/social/content?${params.toString()}`);
    setLoading(false);

    if (!ok) {
      setItems([]);
      setStatus(json?.error ?? "No se pudo cargar contenido.");
      return;
    }

    setItems(json.items ?? []);
  };

  useEffect(() => {
    setSelected(null);
    setMessage("");
    void loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentType]);

  const chooseItem = (item: SearchItem) => {
    setSelected(item);
    setMessage(item.text || item.title);
    setDestination(destinationsFor(item.type)[0].value);
  };

  const publishNow = async () => {
    if (!selected) {
      setStatus("Selecciona una pieza antes de publicar.");
      return;
    }

    setPublishing(true);
    setStatus(null);

    try {
      if ((selected.type === "news" || selected.type === "blog") && destination === "facebook") {
        const result = await publishEditorialToFacebook({
          kind: selected.type,
          id: selected.id,
          slug: selected.slug,
          title: selected.title,
          text: message
        });
        if (!result.ok) throw new Error(result.json?.error ?? "No se pudo publicar en Facebook.");
      } else if ((selected.type === "news" || selected.type === "blog") && destination.startsWith("instagram")) {
        const result = await publishEditorialToInstagram({
          kind: selected.type,
          id: selected.id,
          slug: selected.slug,
          title: selected.title,
          text: message,
          coverUrl: selected.imageUrl,
          story: destination === "instagram_story"
        });
        if (!result.ok) throw new Error(result.json?.error ?? "No se pudo publicar en Instagram.");
      } else if (selected.type === "episode" && destination === "facebook") {
        const result = await authApiRequest("/api/social/meta/facebook/post-episode", {
          method: "POST",
          jsonBody: {
            episodeId: selected.id,
            episodeSlug: selected.slug,
            title: selected.title,
            description: selected.text,
            sourceUrl: selected.linkUrl,
            customText: message
          }
        });
        if (!result.ok) throw new Error(result.json?.error ?? "No se pudo publicar el episodio.");
      } else {
        throw new Error("La combinación de contenido y red no está disponible.");
      }

      toast.success("Publicado ahora.");
      setStatus("Publicado correctamente. No se creó ninguna programación.");
    } catch (error: any) {
      const text = String(error?.message ?? "No se pudo publicar.");
      setStatus(text);
      toast.error(text);
    } finally {
      setPublishing(false);
    }
  };

  if (availableTypes.length === 0) {
    return (
      <main>
        <h1 className="section-title">Publicar ahora</h1>
        <p className="muted">Tu cuenta no tiene permisos de publicación.</p>
      </main>
    );
  }

  return (
    <main>
      <div className="dashboard-section-intro">
        <div>
          <p className="page-kicker">Redes sociales</p>
          <h1 className="section-title">Publicar ahora</h1>
          <p className="muted">Esta pantalla solo publica contenido existente de inmediato. La programación se maneja desde Sin Pelos AI.</p>
        </div>
      </div>

      {status ? (
        <div className="card" style={{ marginTop: 12 }}>
          <p className="muted" style={{ margin: 0 }}>{status}</p>
        </div>
      ) : null}

      <section className="card" style={{ marginTop: 16, display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {availableTypes.map((type) => (
            <button
              key={type}
              className={contentType === type ? "button" : "button secondary"}
              type="button"
              onClick={() => setContentType(type)}
            >
              {type === "news" ? "Noticias" : type === "blog" ? "Editoriales" : "Episodios"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 }}>
          <input
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadContent();
            }}
            placeholder="Buscar contenido..."
          />
          <button className="button secondary" type="button" onClick={() => void loadContent()} disabled={loading}>
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.8fr)", gap: 18, marginTop: 18, alignItems: "start" }}>
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Contenido</h2>
          {loading ? <p className="muted">Cargando...</p> : null}
          {!loading && items.length === 0 ? <p className="muted">No hay contenido para mostrar.</p> : null}
          <div className="list">
            {items.map((item) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                className="card"
                onClick={() => chooseItem(item)}
                style={{ width: "100%", textAlign: "left", cursor: "pointer", borderColor: selected?.id === item.id ? "var(--accent)" : undefined }}
              >
                <strong>{item.title}</strong>
                <div className="muted" style={{ fontSize: 12, marginTop: 5 }}>
                  {item.type === "news" ? "Noticia" : item.type === "blog" ? "Editorial" : "Episodio"} · {fmtDate(item.publishedAt)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="card" style={{ position: "sticky", top: 20 }}>
          <h2 style={{ marginTop: 0 }}>Publicación inmediata</h2>
          {!selected ? (
            <p className="muted">Selecciona una pieza de la lista.</p>
          ) : (
            <div className="form-stack">
              <div>
                <strong>{selected.title}</strong>
                <p className="muted" style={{ marginBottom: 0 }}>Se publicará ahora; no se guardará fecha ni hora futura.</p>
              </div>

              <label>
                Destino
                <select className="input" value={destination} onChange={(event) => setDestination(event.target.value as Destination)}>
                  {destinationOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label>
                Texto
                <textarea className="input" rows={9} value={message} onChange={(event) => setMessage(event.target.value)} />
              </label>

              <button className="button" type="button" onClick={() => void publishNow()} disabled={publishing}>
                {publishing ? "Publicando..." : "Publicar ahora"}
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
