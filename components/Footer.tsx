import Link from "next/link";
import type { Route } from "next";

const footerGroups = [
  {
    title: "Explora",
    links: [
      { href: "/noticias", label: "Noticias" },
      { href: "/feed", label: "Feed" },
      { href: "/podcast", label: "Podcast" },
      { href: "/blog", label: "Blog" },
      { href: "/eventos", label: "Eventos" }
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
    title: "Negocio y legal",
    links: [
      { href: "/publicidad", label: "Publicidad" },
      { href: "/quiero-salir", label: "Invitados" },
      { href: "/rss", label: "RSS audio" },
      { href: "/terminos", label: "Términos" }
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
          <h2>Noticias, podcast y conversación con criterio editorial claro.</h2>
          <p className="muted">
            Una sola plataforma para descubrir lo importante, seguir el programa y entrar a la comunidad sin ruido visual.
          </p>
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
        <span>“Aquí no estamos para agradarte. Estamos para pensar sin miedo.”</span>
        <span>© 2026 Sin Pelos en el Micrófono</span>
      </div>
    </footer>
  );
}
