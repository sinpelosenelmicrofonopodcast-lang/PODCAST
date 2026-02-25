export type PromoSection =
  | "home"
  | "blog"
  | "noticias"
  | "confesionario"
  | "confesiones"
  | "foro"
  | "comunidad"
  | "zona_cruda"
  | "teorias"
  | "feed"
  | "publicidad"
  | "quiero_salir"
  | "other";

export const PROMO_TARGET_SECTIONS: Array<{ id: PromoSection | "all"; label: string }> = [
  { id: "all", label: "Global (All)" },
  { id: "home", label: "Home" },
  { id: "blog", label: "Blog" },
  { id: "noticias", label: "Noticias" },
  { id: "confesionario", label: "Confesionario (landing)" },
  { id: "confesiones", label: "Confesiones" },
  { id: "foro", label: "Foro" },
  { id: "comunidad", label: "Comunidad" },
  { id: "zona_cruda", label: "Zona Cruda" },
  { id: "teorias", label: "Teorias" },
  { id: "feed", label: "Feed" },
  { id: "publicidad", label: "Publicidad" },
  { id: "quiero_salir", label: "Quiero ser parte del panel" }
];

export function promoSectionFromPath(pathname: string): PromoSection {
  const p = String(pathname ?? "").trim() || "/";
  if (p === "/") return "home";
  if (p.startsWith("/blog")) return "blog";
  if (p.startsWith("/noticias")) return "noticias";
  if (p.startsWith("/confesionario")) return "confesionario";
  if (p.startsWith("/confesiones")) return "confesiones";
  if (p.startsWith("/foro")) return "foro";
  if (p.startsWith("/community")) return "comunidad";
  if (p.startsWith("/zona-cruda")) return "zona_cruda";
  if (p.startsWith("/teorias")) return "teorias";
  if (p.startsWith("/feed")) return "feed";
  if (p.startsWith("/publicidad")) return "publicidad";
  if (p.startsWith("/quiero-salir")) return "quiero_salir";
  return "other";
}
