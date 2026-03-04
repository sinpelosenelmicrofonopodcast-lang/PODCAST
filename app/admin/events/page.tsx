"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AdminDeleteButton } from "@/components/AdminDeleteButton";

type EventItem = {
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
  created_at?: string | null;
  updated_at?: string | null;
};

type EventFormState = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  joinUrl: string;
  visibility: "public" | "members" | "paid";

  eventType: string;
  venueName: string;
  addressLine: string;
  city: string;
  flyerUrl: string;
  infoUrl: string;
  ticketUrl: string;

  isFree: boolean;
  priceGeneral: string;
  priceVip: string;
  agePolicy: "all_ages" | "18_plus" | "21_plus";

  parkingAvailable: boolean;
  kidsAllowed: boolean;
  foodAvailable: boolean;
  alcoholAvailable: boolean;
  byobAllowed: boolean;
  wheelchairAccess: boolean;

  organizerName: string;
  organizerLogoUrl: string;
  organizerInstagram: string;
  organizerFacebook: string;
  organizerWebsite: string;
  organizerPhone: string;

  galleryUrls: string;
  promoVideoUrl: string;
  mapUrl: string;
};

const EXTENDED_SELECT =
  "id, title, description, starts_at, ends_at, visibility, join_url, event_type, venue_name, address_line, city, flyer_url, info_url, ticket_url, is_free, price_general, price_vip, age_policy, parking_available, kids_allowed, food_available, alcohol_available, byob_allowed, wheelchair_access, organizer_name, organizer_logo_url, organizer_instagram, organizer_facebook, organizer_website, organizer_phone, gallery_urls, promo_video_url, map_url, created_at, updated_at";

const LEGACY_SELECT = "id, title, description, starts_at, ends_at, visibility, join_url";

const defaultForm = (): EventFormState => ({
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  joinUrl: "",
  visibility: "public",

  eventType: "musica",
  venueName: "",
  addressLine: "",
  city: "",
  flyerUrl: "",
  infoUrl: "",
  ticketUrl: "",

  isFree: true,
  priceGeneral: "",
  priceVip: "",
  agePolicy: "all_ages",

  parkingAvailable: false,
  kidsAllowed: false,
  foodAvailable: false,
  alcoholAvailable: false,
  byobAllowed: false,
  wheelchairAccess: false,

  organizerName: "",
  organizerLogoUrl: "",
  organizerInstagram: "",
  organizerFacebook: "",
  organizerWebsite: "",
  organizerPhone: "",

  galleryUrls: "",
  promoVideoUrl: "",
  mapUrl: ""
});

const eventTypeOptions = [
  { value: "musica", label: "Música" },
  { value: "comedia", label: "Comedia" },
  { value: "festival", label: "Festival" },
  { value: "negocios", label: "Negocios" },
  { value: "familia", label: "Familia" },
  { value: "food_truck", label: "Food Truck" },
  { value: "deportes", label: "Deportes" },
  { value: "otro", label: "Otro" }
];

const agePolicyOptions = [
  { value: "all_ages", label: "All ages" },
  { value: "18_plus", label: "18+" },
  { value: "21_plus", label: "21+" }
] as const;

const missingExtendedColumnsRegex =
  /(event_type|venue_name|address_line|city|flyer_url|info_url|ticket_url|is_free|price_general|price_vip|age_policy|parking_available|kids_allowed|food_available|alcohol_available|byob_allowed|wheelchair_access|organizer_name|organizer_logo_url|organizer_instagram|organizer_facebook|organizer_website|organizer_phone|gallery_urls|promo_video_url|map_url|created_at|updated_at)/i;

function toDatetimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}

function cleanNullableText(value: string) {
  const v = value.trim();
  return v.length > 0 ? v : null;
}

export default function AdminEventsPage() {
  const [form, setForm] = useState<EventFormState>(defaultForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(false);

  const isEditing = editingId !== null;

  const load = async () => {
    const primary = await supabase.from("live_events").select(EXTENDED_SELECT).order("starts_at", { ascending: true });
    if (primary.error && missingExtendedColumnsRegex.test(primary.error.message ?? "")) {
      const fallback = await supabase.from("live_events").select(LEGACY_SELECT).order("starts_at", { ascending: true });
      setItems((fallback.data as EventItem[]) ?? []);
      return;
    }
    setItems((primary.data as EventItem[]) ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm(defaultForm());
    setEditingId(null);
  };

  const basePayload = useMemo(
    () => ({
      title: form.title,
      description: cleanNullableText(form.description),
      starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      join_url: cleanNullableText(form.joinUrl),
      visibility: form.visibility
    }),
    [form.description, form.endsAt, form.joinUrl, form.startsAt, form.title, form.visibility]
  );

  const extendedPayload = useMemo(
    () => ({
      ...basePayload,
      event_type: cleanNullableText(form.eventType),
      venue_name: cleanNullableText(form.venueName),
      address_line: cleanNullableText(form.addressLine),
      city: cleanNullableText(form.city),
      flyer_url: cleanNullableText(form.flyerUrl),
      info_url: cleanNullableText(form.infoUrl),
      ticket_url: cleanNullableText(form.ticketUrl),
      is_free: form.isFree,
      price_general: form.isFree ? null : cleanNullableText(form.priceGeneral),
      price_vip: form.isFree ? null : cleanNullableText(form.priceVip),
      age_policy: form.agePolicy,
      parking_available: form.parkingAvailable,
      kids_allowed: form.kidsAllowed,
      food_available: form.foodAvailable,
      alcohol_available: form.alcoholAvailable,
      byob_allowed: form.byobAllowed,
      wheelchair_access: form.wheelchairAccess,
      organizer_name: cleanNullableText(form.organizerName),
      organizer_logo_url: cleanNullableText(form.organizerLogoUrl),
      organizer_instagram: cleanNullableText(form.organizerInstagram),
      organizer_facebook: cleanNullableText(form.organizerFacebook),
      organizer_website: cleanNullableText(form.organizerWebsite),
      organizer_phone: cleanNullableText(form.organizerPhone),
      gallery_urls: form.galleryUrls
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean),
      promo_video_url: cleanNullableText(form.promoVideoUrl),
      map_url: cleanNullableText(form.mapUrl)
    }),
    [
      basePayload,
      form.addressLine,
      form.agePolicy,
      form.alcoholAvailable,
      form.byobAllowed,
      form.city,
      form.eventType,
      form.flyerUrl,
      form.foodAvailable,
      form.galleryUrls,
      form.infoUrl,
      form.isFree,
      form.kidsAllowed,
      form.mapUrl,
      form.organizerFacebook,
      form.organizerInstagram,
      form.organizerLogoUrl,
      form.organizerName,
      form.organizerPhone,
      form.organizerWebsite,
      form.parkingAvailable,
      form.priceGeneral,
      form.priceVip,
      form.promoVideoUrl,
      form.ticketUrl,
      form.venueName,
      form.wheelchairAccess
    ]
  );

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus(null);
    setLoading(true);

    const runMutation = async (payload: Record<string, any>) => {
      if (editingId) {
        return supabase.from("live_events").update(payload).eq("id", editingId);
      }
      return supabase.from("live_events").insert(payload);
    };

    let res = await runMutation(extendedPayload);

    if (res.error && missingExtendedColumnsRegex.test(res.error.message ?? "")) {
      res = await runMutation(basePayload);
      if (!res.error) {
        setStatus(
          "Evento guardado en modo compatible. Ejecuta `supabase/live_events_community_plus.sql` para habilitar todos los campos nuevos."
        );
      }
    }

    if (res.error) {
      setStatus(res.error.message);
      setLoading(false);
      return;
    }

    setStatus(editingId ? "Evento actualizado." : "Evento creado.");
    resetForm();
    await load();
    setLoading(false);
  };

  const edit = (item: EventItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title ?? "",
      description: item.description ?? "",
      startsAt: toDatetimeLocal(item.starts_at),
      endsAt: toDatetimeLocal(item.ends_at),
      joinUrl: item.join_url ?? "",
      visibility: (item.visibility as EventFormState["visibility"]) ?? "public",

      eventType: item.event_type ?? "musica",
      venueName: item.venue_name ?? "",
      addressLine: item.address_line ?? "",
      city: item.city ?? "",
      flyerUrl: item.flyer_url ?? "",
      infoUrl: item.info_url ?? "",
      ticketUrl: item.ticket_url ?? "",

      isFree: item.is_free ?? true,
      priceGeneral: item.price_general ?? "",
      priceVip: item.price_vip ?? "",
      agePolicy: (item.age_policy as EventFormState["agePolicy"]) ?? "all_ages",

      parkingAvailable: item.parking_available ?? false,
      kidsAllowed: item.kids_allowed ?? false,
      foodAvailable: item.food_available ?? false,
      alcoholAvailable: item.alcohol_available ?? false,
      byobAllowed: item.byob_allowed ?? false,
      wheelchairAccess: item.wheelchair_access ?? false,

      organizerName: item.organizer_name ?? "",
      organizerLogoUrl: item.organizer_logo_url ?? "",
      organizerInstagram: item.organizer_instagram ?? "",
      organizerFacebook: item.organizer_facebook ?? "",
      organizerWebsite: item.organizer_website ?? "",
      organizerPhone: item.organizer_phone ?? "",

      galleryUrls: (item.gallery_urls ?? []).join(", "),
      promoVideoUrl: item.promo_video_url ?? "",
      mapUrl: item.map_url ?? ""
    });
  };

  return (
    <main>
      <h1 className="section-title">Eventos (Admin)</h1>
      <p className="muted">Gestiona eventos de comunidad con formato completo tipo cartelera.</p>

      <form className="card form-stack" onSubmit={submit} style={{ marginTop: 20 }}>
        <h3 style={{ marginTop: 0 }}>1) Información básica</h3>
        <label>
          Título del evento
          <input
            className="input"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />
        </label>
        <label>
          Descripción
          <textarea
            className="textarea"
            rows={4}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </label>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Inicio (fecha y hora)
            <input
              className="input"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm((prev) => ({ ...prev, startsAt: e.target.value }))}
            />
          </label>
          <label>
            Fin (fecha y hora)
            <input
              className="input"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm((prev) => ({ ...prev, endsAt: e.target.value }))}
            />
          </label>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Tipo de evento
            <select
              className="select"
              value={form.eventType}
              onChange={(e) => setForm((prev) => ({ ...prev, eventType: e.target.value }))}
            >
              {eventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Visibilidad
            <select
              className="select"
              value={form.visibility}
              onChange={(e) => setForm((prev) => ({ ...prev, visibility: e.target.value as EventFormState["visibility"] }))}
            >
              <option value="public">Public</option>
              <option value="members">Members</option>
              <option value="paid">Paid</option>
            </select>
          </label>
        </div>
        <label>
          Lugar / Venue
          <input
            className="input"
            value={form.venueName}
            onChange={(e) => setForm((prev) => ({ ...prev, venueName: e.target.value }))}
            placeholder="Venue 254 Event Hall"
          />
        </label>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Dirección completa
            <input
              className="input"
              value={form.addressLine}
              onChange={(e) => setForm((prev) => ({ ...prev, addressLine: e.target.value }))}
              placeholder="123 Main St"
            />
          </label>
          <label>
            Ciudad
            <input
              className="input"
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="Killeen"
            />
          </label>
        </div>
        <label>
          Flyer / imagen del evento (URL)
          <input
            className="input"
            value={form.flyerUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, flyerUrl: e.target.value }))}
            placeholder="https://..."
          />
        </label>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Link de información
            <input
              className="input"
              value={form.infoUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, infoUrl: e.target.value }))}
              placeholder="https://..."
            />
          </label>
          <label>
            Link de tickets
            <input
              className="input"
              value={form.ticketUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, ticketUrl: e.target.value }))}
              placeholder="https://..."
            />
          </label>
        </div>

        <h3 style={{ marginBottom: 0 }}>2) Precio y edad</h3>
        <label className="check-row">
          <input type="checkbox" checked={form.isFree} onChange={(e) => setForm((prev) => ({ ...prev, isFree: e.target.checked }))} />
          Gratis
        </label>
        {!form.isFree ? (
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label>
              Precio general
              <input
                className="input"
                value={form.priceGeneral}
                onChange={(e) => setForm((prev) => ({ ...prev, priceGeneral: e.target.value }))}
                placeholder="$15"
              />
            </label>
            <label>
              Precio VIP
              <input
                className="input"
                value={form.priceVip}
                onChange={(e) => setForm((prev) => ({ ...prev, priceVip: e.target.value }))}
                placeholder="$60"
              />
            </label>
          </div>
        ) : null}
        <label>
          Edad permitida
          <select
            className="select"
            value={form.agePolicy}
            onChange={(e) => setForm((prev) => ({ ...prev, agePolicy: e.target.value as EventFormState["agePolicy"] }))}
          >
            {agePolicyOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <h3 style={{ marginBottom: 0 }}>3) Detalles importantes</h3>
        <div className="check-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label className="check-row compact">
            <input
              type="checkbox"
              checked={form.parkingAvailable}
              onChange={(e) => setForm((prev) => ({ ...prev, parkingAvailable: e.target.checked }))}
            />
            Estacionamiento disponible
          </label>
          <label className="check-row compact">
            <input type="checkbox" checked={form.kidsAllowed} onChange={(e) => setForm((prev) => ({ ...prev, kidsAllowed: e.target.checked }))} />
            Se permiten niños
          </label>
          <label className="check-row compact">
            <input type="checkbox" checked={form.foodAvailable} onChange={(e) => setForm((prev) => ({ ...prev, foodAvailable: e.target.checked }))} />
            Venta de comida
          </label>
          <label className="check-row compact">
            <input
              type="checkbox"
              checked={form.alcoholAvailable}
              onChange={(e) => setForm((prev) => ({ ...prev, alcoholAvailable: e.target.checked }))}
            />
            Venta de alcohol
          </label>
          <label className="check-row compact">
            <input type="checkbox" checked={form.byobAllowed} onChange={(e) => setForm((prev) => ({ ...prev, byobAllowed: e.target.checked }))} />
            BYOB permitido
          </label>
          <label className="check-row compact">
            <input
              type="checkbox"
              checked={form.wheelchairAccess}
              onChange={(e) => setForm((prev) => ({ ...prev, wheelchairAccess: e.target.checked }))}
            />
            Accesible (wheelchair)
          </label>
        </div>

        <h3 style={{ marginBottom: 0 }}>4) Organizador</h3>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Organizador
            <input
              className="input"
              value={form.organizerName}
              onChange={(e) => setForm((prev) => ({ ...prev, organizerName: e.target.value }))}
            />
          </label>
          <label>
            Logo organizador (URL)
            <input
              className="input"
              value={form.organizerLogoUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, organizerLogoUrl: e.target.value }))}
              placeholder="https://..."
            />
          </label>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Instagram
            <input
              className="input"
              value={form.organizerInstagram}
              onChange={(e) => setForm((prev) => ({ ...prev, organizerInstagram: e.target.value }))}
            />
          </label>
          <label>
            Facebook
            <input
              className="input"
              value={form.organizerFacebook}
              onChange={(e) => setForm((prev) => ({ ...prev, organizerFacebook: e.target.value }))}
            />
          </label>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Website
            <input
              className="input"
              value={form.organizerWebsite}
              onChange={(e) => setForm((prev) => ({ ...prev, organizerWebsite: e.target.value }))}
              placeholder="https://..."
            />
          </label>
          <label>
            Teléfono
            <input
              className="input"
              value={form.organizerPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, organizerPhone: e.target.value }))}
            />
          </label>
        </div>

        <h3 style={{ marginBottom: 0 }}>5) Multimedia y extras</h3>
        <label>
          Galería (URLs separadas por coma)
          <input
            className="input"
            value={form.galleryUrls}
            onChange={(e) => setForm((prev) => ({ ...prev, galleryUrls: e.target.value }))}
            placeholder="https://img1.jpg, https://img2.jpg"
          />
        </label>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <label>
            Video promo (URL)
            <input
              className="input"
              value={form.promoVideoUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, promoVideoUrl: e.target.value }))}
              placeholder="https://youtube.com/..."
            />
          </label>
          <label>
            Mapa (Google Maps URL)
            <input
              className="input"
              value={form.mapUrl}
              onChange={(e) => setForm((prev) => ({ ...prev, mapUrl: e.target.value }))}
              placeholder="https://maps.google.com/..."
            />
          </label>
        </div>

        <label>
          Link de transmisión / sala en vivo
          <input
            className="input"
            value={form.joinUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, joinUrl: e.target.value }))}
            placeholder="https://..."
          />
        </label>

        <div className="form-submit-bar">
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Guardando..." : isEditing ? "Actualizar evento" : "Crear evento"}
          </button>
          {isEditing ? (
            <button className="button secondary" type="button" onClick={resetForm}>
              Cancelar edición
            </button>
          ) : null}
        </div>
        {status ? (
          <p className="muted" style={{ margin: 0 }}>
            {status}
          </p>
        ) : null}
      </form>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ marginTop: 0 }}>Eventos cargados</h3>
        <div className="list" style={{ marginTop: 12 }}>
          {items.map((item) => (
            <div key={item.id} className="card" style={{ display: "grid", gap: 10 }}>
              <strong>{item.title}</strong>
              <span className="muted" style={{ fontSize: 12 }}>
                {item.starts_at ? new Date(item.starts_at).toLocaleString("es-PR") : "Sin fecha"}
                {item.city ? ` · ${item.city}` : ""}
                {item.event_type ? ` · ${item.event_type}` : ""}
                {item.visibility ? ` · ${item.visibility}` : ""}
              </span>
              <div className="admin-item-actions">
                <button className="button secondary" type="button" onClick={() => edit(item)}>
                  Editar
                </button>
                <AdminDeleteButton table="live_events" id={item.id} label="Eliminar" />
              </div>
            </div>
          ))}
          {items.length === 0 ? <p className="muted">No hay eventos aún.</p> : null}
        </div>
      </div>
    </main>
  );
}
