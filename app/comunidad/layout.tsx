import type { Metadata } from "next";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Comunidad | Sin Pelos",
  description: "Área privada de comunidad.",
  path: "/comunidad",
  noindex: true
});

export default function ComunidadLayout({ children }: { children: React.ReactNode }) {
  return children;
}

