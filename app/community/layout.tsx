import type { Metadata } from "next";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Comunidad privada | Sin Pelos",
  description: "Área privada de comunidad.",
  path: "/community",
  noindex: true
});

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}

