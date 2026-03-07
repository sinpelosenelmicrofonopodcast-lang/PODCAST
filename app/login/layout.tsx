import type { Metadata } from "next";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Ingresar | Sin Pelos",
  description: "Acceso de usuarios.",
  path: "/login",
  noindex: true
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
