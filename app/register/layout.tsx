import type { Metadata } from "next";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Registro | Sin Pelos",
  description: "Registro de usuarios.",
  path: "/register",
  noindex: true
});

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
