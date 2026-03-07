import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Entrar | Sin Pelos",
  description: "Acceso de usuarios.",
  path: "/entrar",
  noindex: true
});

export default function EntrarPage() {
  redirect("/login");
}

