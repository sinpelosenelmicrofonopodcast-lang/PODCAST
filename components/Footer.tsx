import { ListenLinks } from "@/components/podcast/ListenLinks";
import Link from "next/link";
import type { Route } from "next";

const footerGroups = [
  {
    title: "Explora",
    links: [
      { href: "/podcast", label: "Episodios" },
      { href: "/blog", label: "Desde el Micrófono" },
      { href: "/noticias", label: "Noticias" },
      { href: "/podcast", label: "Catálogo completo" },
      { href: "/eventos", label: "Eventos" },
      { href: "/setup", label: "El Setup de Sin Pelos" }
    ]
  },
  {
    title: "Comunidad",
    links: [
      { href: "/community", label: "Hub privado" },
      { href: "/foro", label: "Foro" },
      { href: "/confesionario", label: "Confesionario" },
      { href: "/teorias", label: "Teorías" },
      { href: "/zona-cruda", label: "Zona Cruda" }
    ]
  },
  {
    title: "Sin Pelos",
    links: [
      { href: "/acerca", label: "Conócenos" },
      { href: "/quiero-salir", label: "Quiero ser invitado" },
      { href: "/publicidad", label: "Publicidad" },
      { href: "/rss", label: "RSS / Audio" },
      { href: "/terms", label: "Términos" },
      { href: "/privacy", label: "Privacidad" }
    ]
  }
];

type FooterGroup = {
  title: string;
  links: { href: Route; label: string }[];
};

export function Footer() {
  const groups = footerGroups as FooterGroup[];

  return (
    <footer className="footer-shell">
      <div className="container footer-grid">
        <div className="footer-brand">
          <p className="footer-kicker">Sin Pelos en el Micrófono</p>
          <h2>La conversación no termina cuando se apagan los micrófonos.</h2>
          <p className="muted">
            Episodios, historias, enseñanzas y comunidad. Lo que se dijo en la mesa sigue viviendo aquí.
          </p>
          <ListenLinks />
        </div>

        {groups.map((group) => (
          <div key={group.title} className="footer-column">
            <h3>{group.title}</h3>
            <div className="footer-links">
              {group.links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="container footer-bottom">
        <span>“Aquí no venimos a quedar bien. Venimos a hablar claro.”</span>
        <span>© 2026 Sin Pelos en el Micrófono · B&B Entertainment Hub LLC</span>
      </div>
    </footer>
  );
}
