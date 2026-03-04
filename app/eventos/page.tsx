"use client";

import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/lib/supabaseClient";
import { useProtectedUser } from "@/lib/useProtectedUser";
import { toast } from "@/lib/toast";

type LiveEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  visibility: string;
  join_url: string | null;
  event_type?: string | null;
  venue_name?: string | null;
  address_line?: string | null;
  city?: string | null;
  flyer_url?: string | null;
  info_url?: string | null;
  ticket_url?: string | null;
  is_free?: boolean | null;
  price_general?: string | null;
  price_vip?: string | null;
  age_policy?: string | null;
  parking_available?: boolean | null;
  kids_allowed?: boolean | null;
  food_available?: boolean | null;
  alcohol_available?: boolean | null;
  byob_allowed?: boolean | null;
  wheelchair_access?: boolean | null;
  organizer_name?: string | null;
  organizer_logo_url?: string | null;
  organizer_instagram?: string | null;
  organizer_facebook?: string | null;
  organizer_website?: string | null;
  organizer_phone?: string | null;
  gallery_urls?: string[] | null;
  promo_video_url?: string | null;
  map_url?: string | null;
};

type EventRsvpRow = {
  event_id: string;
  status: "interested" | "going";
};

type EventCounts = {
  interested: number;
  going: number;
};

const EXTENDED_SELECT =
  "id, title, description, starts_at, ends_at, visibility, join_url, event_type, venue_name, address_line, city, flyer_url, info_url, ticket_url, is_free, price_general, price_vip, age_policy, parking_available, kids_allowed, food_available, alcohol_available, byob_allowed, wheelchair_access, organizer_name, organizer_logo_url, organizer_instagram, organizer_facebook, organizer_website, organizer_phone, gallery_urls, promo_video_url, map_url";
const LEGACY_SELECT = "id, title, description, starts_at, ends_at, visibility, join_url";

const EVENT_TYPE_LABELS: Record<string, string> = {
  musica: "Música",
  comedia: "Comedia",
  festival: "Festival",
  negocios: "Negocios",
  familia: "Familia",
  food_truck: "Food Truck",
  deportes: "Deportes",
  otro: "Otro"
};

const AGE_LABELS: Record<string, string> = {
  all_ages: "All ages",
  "18_plus": "18+",
  "21_plus": "21+"
};

const missingExtendedColumnsRegex =
  /(event_type|venue_name|address_line|city|flyer_url|info_url|ticket_url|is_free|price_general|price_vip|age_policy|parking_available|kids_allowed|food_available|alcohol_available|byob_allowed|wheelchair_access|organizer_name|organizer_logo_url|organizer_instagram|organizer_facebook|organizer_website|organizer_phone|gallery_urls|promo_video_url|map_url)/i;

const formatDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleDateString("es-PR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("es-PR", {
    hour: "2-digit",
    minute: "2-digit"
  });
};

const getDaysLeft = (value?: string | null) => {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  if (days < 0) return null;
  return days;
};

const normalizeMapUrl = (event: LiveEvent) => {
  if (event.map_url) return event.map_url;
  const parts = [event.venue_name, event.address_line, event.city].map((v) => String(v ?? "").trim()).filter(Boolean);
  if (parts.length === 0) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`;
};

const buildEventPageUrl = (eventId: string) => {
  const base = typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${base}/eventos#evento-${eventId}`;
};

const buildGoogleCalendarUrl = (event: LiveEvent) => {
  const start = event.starts_at ? new Date(event.starts_at) : null;
  if (!start) return null;
  const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const location = [event.venue_name, event.address_line, event.city].filter(Boolean).join(", ");
  const details = [event.description, event.info_url, event.ticket_url].filter(Boolean).join("\n\n");
  const query = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${fmt(start)}/${fmt(end)}`,
    details,
    location
  });
  return `https://calendar.google.com/calendar/render?${query.toString()}`;
};

const buildIcsDataUrl = (event: LiveEvent) => {
  const start = event.starts_at ? new Date(event.starts_at) : null;
  if (!start) return null;
  const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const location = [event.venue_name, event.address_line, event.city].filter(Boolean).join(", ");
  const description = [event.description, event.info_url, event.ticket_url].filter(Boolean).join("\\n\\n");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sin Pelos//Eventos//ES",
    "BEGIN:VEVENT",
    `UID:${event.id}@sinpelosenelmicrofono.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title.replace(/\n/g, " ")}`,
    `DESCRIPTION:${description.replace(/\n/g, "\\n")}`,
    `LOCATION:${location.replace(/\n/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\n");

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`;
};

export default function EventosPage() {
  const { checking, userId } = useProtectedUser();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rsvpEnabled, setRsvpEnabled] = useState(true);
  const [rsvpMap, setRsvpMap] = useState<Record<string, "interested" | "going" | null>>({});
  const [countsMap, setCountsMap] = useState<Record<string, EventCounts>>({});
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);

  const loadRsvps = async (eventIds: string[], currentUserId: string) => {
    if (eventIds.length === 0) {
      setRsvpMap({});
      setCountsMap({});
      return;
    }

    const allRowsRes = await supabase
      .from("event_rsvps")
      .select("event_id, status")
      .in("event_id", eventIds);

    if (allRowsRes.error) {
      const msg = String(allRowsRes.error.message ?? "");
      if (/event_rsvps|does not exist|schema cache/i.test(msg)) {
        setRsvpEnabled(false);
        setRsvpMap({});
        setCountsMap({});
        return;
      }
      throw new Error(allRowsRes.error.message);
    }

    const mineRes = await supabase
      .from("event_rsvps")
      .select("event_id, status")
      .eq("user_id", currentUserId)
      .in("event_id", eventIds);

    if (mineRes.error) {
      throw new Error(mineRes.error.message);
    }

    const nextCounts: Record<string, EventCounts> = {};
    eventIds.forEach((id) => {
      nextCounts[id] = { interested: 0, going: 0 };
    });

    ((allRowsRes.data ?? []) as EventRsvpRow[]).forEach((row) => {
      const bucket = nextCounts[row.event_id] ?? { interested: 0, going: 0 };
      if (row.status === "interested") bucket.interested += 1;
      if (row.status === "going") bucket.going += 1;
      nextCounts[row.event_id] = bucket;
    });

    const mineMap: Record<string, "interested" | "going" | null> = {};
    eventIds.forEach((id) => {
      mineMap[id] = null;
    });
    ((mineRes.data ?? []) as EventRsvpRow[]).forEach((row) => {
      mineMap[row.event_id] = row.status;
    });

    setCountsMap(nextCounts);
    setRsvpMap(mineMap);
  };

  useEffect(() => {
    if (!userId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setStatus(null);
      setRsvpEnabled(true);

      const nowIso = new Date().toISOString();
      const primary = await supabase
        .from("live_events")
        .select(EXTENDED_SELECT)
        .gte("starts_at", nowIso)
        .order("starts_at", { ascending: true });

      let rows: LiveEvent[] = [];
      if (primary.error && missingExtendedColumnsRegex.test(primary.error.message ?? "")) {
        const fallback = await supabase
          .from("live_events")
          .select(LEGACY_SELECT)
          .gte("starts_at", nowIso)
          .order("starts_at", { ascending: true });
        rows = ((fallback.data ?? []) as LiveEvent[]).filter((item) => item.starts_at);
        if (!fallback.error && mounted) {
          setStatus(
            "Vista en modo compatible. Ejecuta `supabase/live_events_community_plus.sql` para habilitar todos los datos de eventos."
          );
        }
      } else if (primary.error) {
        if (mounted) setStatus(primary.error.message);
      } else {
        rows = ((primary.data ?? []) as LiveEvent[]).filter((item) => item.starts_at);
      }

      if (!mounted) return;
      setEvents(rows);

      try {
        await loadRsvps(
          rows.map((e) => e.id),
          userId
        );
      } catch (error) {
        if (mounted) {
          setStatus(error instanceof Error ? error.message : "No se pudieron cargar los RSVP.");
        }
      }

      if (mounted) setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      const city = String(event.city ?? "").trim().toLowerCase();
      const type = String(event.event_type ?? "").trim().toLowerCase();
      const haystack = [event.title, event.description, event.venue_name, event.city, EVENT_TYPE_LABELS[type] ?? ""]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      const bySearch = term.length === 0 || haystack.includes(term);
      const byCity = cityFilter === "all" || city === cityFilter;
      const byType = typeFilter === "all" || type === typeFilter;
      return bySearch && byCity && byType;
    });
  }, [cityFilter, events, search, typeFilter]);

  const cityOptions = useMemo(() => {
    const cities = Array.from(new Set(events.map((e) => String(e.city ?? "").trim()).filter(Boolean)));
    return cities.sort((a, b) => a.localeCompare(b));
  }, [events]);

  const handleRsvp = async (eventId: string, next: "interested" | "going") => {
    if (!userId || !rsvpEnabled) return;

    const current = rsvpMap[eventId] ?? null;
    setUpdatingEventId(eventId);

    if (current === next) {
      const { error } = await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", userId);
      if (error) {
        toast.error(error.message);
        setUpdatingEventId(null);
        return;
      }
      setRsvpMap((prev) => ({ ...prev, [eventId]: null }));
      setCountsMap((prev) => {
        const currentCounts = prev[eventId] ?? { interested: 0, going: 0 };
        const adjusted = {
          interested: Math.max(0, currentCounts.interested - (current === "interested" ? 1 : 0)),
          going: Math.max(0, currentCounts.going - (current === "going" ? 1 : 0))
        };
        return { ...prev, [eventId]: adjusted };
      });
      toast.success("RSVP removido.");
      setUpdatingEventId(null);
      return;
    }

    const { error } = await supabase.from("event_rsvps").upsert(
      {
        event_id: eventId,
        user_id: userId,
        status: next
      },
      { onConflict: "event_id,user_id" }
    );

    if (error) {
      toast.error(error.message);
      setUpdatingEventId(null);
      return;
    }

    setRsvpMap((prev) => ({ ...prev, [eventId]: next }));
    setCountsMap((prev) => {
      const currentCounts = prev[eventId] ?? { interested: 0, going: 0 };
      const wasInterested = current === "interested" ? 1 : 0;
      const wasGoing = current === "going" ? 1 : 0;
      const nextInterested = next === "interested" ? 1 : 0;
      const nextGoing = next === "going" ? 1 : 0;
      return {
        ...prev,
        [eventId]: {
          interested: Math.max(0, currentCounts.interested - wasInterested + nextInterested),
          going: Math.max(0, currentCounts.going - wasGoing + nextGoing)
        }
      };
    });

    toast.success(next === "going" ? "Marcado como voy a ir." : "Marcado como me interesa.");
    setUpdatingEventId(null);
  };

  const copyLink = async (eventId: string) => {
    const url = buildEventPageUrl(eventId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("No se pudo copiar el link.");
    }
  };

  return (
    <main>
      <Navbar />
      <section className="section events-page">
        <div className="container events-container">
          <div className="events-hero card">
            <h1 className="section-title" style={{ marginBottom: 8 }}>
              Eventos de la Comunidad
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              Cartelera con música, comedia, negocios y cultura. Filtra por ciudad, marca tu asistencia y agrégalo al calendario.
            </p>
            <div className="events-filters">
              <input
                className="input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título, ciudad o venue"
              />
              <select className="select" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
                <option value="all">Todas las ciudades</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city.toLowerCase()}>
                    {city}
                  </option>
                ))}
              </select>
              <select className="select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="all">Todos los tipos</option>
                {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <a className="button secondary" href="/quiero-salir">
                Submit your event
              </a>
            </div>
          </div>

          {checking || loading ? (
            <div className="card" style={{ marginTop: 20 }}>
              <p className="muted">Cargando eventos...</p>
            </div>
          ) : null}

          {!checking && !loading ? (
            <>
              {status ? (
                <div className="card" style={{ marginTop: 20 }}>
                  <p className="muted" style={{ margin: 0 }}>
                    {status}
                  </p>
                </div>
              ) : null}

              <div className="events-grid" style={{ marginTop: 20 }}>
                {filteredEvents.map((event) => {
                  const counts = countsMap[event.id] ?? { interested: 0, going: 0 };
                  const myStatus = rsvpMap[event.id] ?? null;
                  const daysLeft = getDaysLeft(event.starts_at);
                  const mapUrl = normalizeMapUrl(event);
                  const googleCalUrl = buildGoogleCalendarUrl(event);
                  const icsUrl = buildIcsDataUrl(event);

                  return (
                    <article key={event.id} id={`evento-${event.id}`} className="card event-card-full">
                      <div className="event-card-media-wrap">
                        {event.flyer_url ? <img src={event.flyer_url} alt={event.title} className="event-card-media" /> : <div className="event-card-media-fallback" />}
                        <div className="event-card-type-badge">{EVENT_TYPE_LABELS[String(event.event_type ?? "").toLowerCase()] ?? "Evento"}</div>
                        {daysLeft !== null ? (
                          <div className="event-card-countdown">
                            {daysLeft === 0 ? "Hoy" : `Faltan ${daysLeft} día${daysLeft === 1 ? "" : "s"}`}
                          </div>
                        ) : null}
                      </div>

                      <div className="event-card-body">
                        <h3>{event.title}</h3>
                        <div className="event-card-meta">
                          <span>{formatDate(event.starts_at)}</span>
                          <span className="dot">·</span>
                          <span>{formatTime(event.starts_at)}</span>
                          {event.venue_name ? (
                            <>
                              <span className="dot">·</span>
                              <span>{event.venue_name}</span>
                            </>
                          ) : null}
                          {event.city ? (
                            <>
                              <span className="dot">·</span>
                              <span>{event.city}</span>
                            </>
                          ) : null}
                        </div>

                        {event.description ? <p className="muted event-card-description">{event.description}</p> : null}

                        <div className="event-pill-row">
                          <span className="event-pill">{event.is_free ? "Gratis" : `General: ${event.price_general ?? "N/D"}`}</span>
                          {!event.is_free && event.price_vip ? <span className="event-pill">VIP: {event.price_vip}</span> : null}
                          <span className="event-pill">{AGE_LABELS[event.age_policy ?? "all_ages"] ?? "All ages"}</span>
                        </div>

                        <div className="event-feature-grid">
                          <span className={event.parking_available ? "on" : "off"}>Estacionamiento: {event.parking_available ? "Sí" : "No"}</span>
                          <span className={event.kids_allowed ? "on" : "off"}>Niños: {event.kids_allowed ? "Sí" : "No"}</span>
                          <span className={event.food_available ? "on" : "off"}>Comida: {event.food_available ? "Sí" : "No"}</span>
                          <span className={event.alcohol_available ? "on" : "off"}>Alcohol: {event.alcohol_available ? "Sí" : "No"}</span>
                          <span className={event.byob_allowed ? "on" : "off"}>BYOB: {event.byob_allowed ? "Sí" : "No"}</span>
                          <span className={event.wheelchair_access ? "on" : "off"}>Accesibilidad: {event.wheelchair_access ? "Sí" : "No"}</span>
                        </div>

                        <div className="event-cta-row">
                          {event.join_url ? (
                            <a className="button" href={event.join_url} target="_blank" rel="noreferrer">
                              Reservar lugar
                            </a>
                          ) : null}
                          {event.ticket_url ? (
                            <a className="button secondary" href={event.ticket_url} target="_blank" rel="noreferrer">
                              Tickets
                            </a>
                          ) : null}
                          {event.info_url ? (
                            <a className="button secondary" href={event.info_url} target="_blank" rel="noreferrer">
                              Más info
                            </a>
                          ) : null}
                          {mapUrl ? (
                            <a className="button secondary" href={mapUrl} target="_blank" rel="noreferrer">
                              Ver mapa
                            </a>
                          ) : null}
                        </div>

                        <div className="event-rsvp-row">
                          <button
                            className={`button secondary ${myStatus === "interested" ? "active" : ""}`}
                            type="button"
                            disabled={!rsvpEnabled || updatingEventId === event.id}
                            onClick={() => handleRsvp(event.id, "interested")}
                          >
                            Me interesa ({counts.interested})
                          </button>
                          <button
                            className={`button secondary ${myStatus === "going" ? "active" : ""}`}
                            type="button"
                            disabled={!rsvpEnabled || updatingEventId === event.id}
                            onClick={() => handleRsvp(event.id, "going")}
                          >
                            Voy a ir ({counts.going})
                          </button>
                        </div>

                        <div className="event-tool-row">
                          {googleCalUrl ? (
                            <a className="event-tool-link" href={googleCalUrl} target="_blank" rel="noreferrer">
                              Google Calendar
                            </a>
                          ) : null}
                          {icsUrl ? (
                            <a className="event-tool-link" href={icsUrl} download={`evento-${event.id}.ics`}>
                              Apple / Outlook
                            </a>
                          ) : null}
                          <a
                            className="event-tool-link"
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(buildEventPageUrl(event.id))}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Compartir
                          </a>
                          <button className="event-tool-link" type="button" onClick={() => copyLink(event.id)}>
                            Copy link
                          </button>
                        </div>

                        {event.organizer_name || event.organizer_instagram || event.organizer_facebook || event.organizer_website ? (
                          <div className="event-organizer-block">
                            <strong>Organiza: {event.organizer_name ?? "Comunidad"}</strong>
                            <div className="event-organizer-links">
                              {event.organizer_instagram ? (
                                <a href={event.organizer_instagram} target="_blank" rel="noreferrer">
                                  Instagram
                                </a>
                              ) : null}
                              {event.organizer_facebook ? (
                                <a href={event.organizer_facebook} target="_blank" rel="noreferrer">
                                  Facebook
                                </a>
                              ) : null}
                              {event.organizer_website ? (
                                <a href={event.organizer_website} target="_blank" rel="noreferrer">
                                  Website
                                </a>
                              ) : null}
                              {event.organizer_phone ? <span>{event.organizer_phone}</span> : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>

              {filteredEvents.length === 0 ? (
                <div className="card" style={{ marginTop: 20 }}>
                  <p className="muted" style={{ margin: 0 }}>
                    No hay eventos para esos filtros.
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
      <Footer />
    </main>
  );
}
