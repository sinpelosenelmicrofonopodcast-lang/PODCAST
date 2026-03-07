import type { Metadata } from "next";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Zona Cruda privada | Sin Pelos",
  description: "Área privada de contenido explícito.",
  path: "/zona-cruda",
  noindex: true
});

export default function ZonaCrudaLayout({ children }: { children: React.ReactNode }) {
  return children;
}

