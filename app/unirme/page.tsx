import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { buildSeoMetadata } from "@/lib/seo/meta";

export const metadata: Metadata = buildSeoMetadata({
  title: "Unirme | Sin Pelos",
  description: "Registro de usuarios.",
  path: "/unirme",
  noindex: true
});

export default function UnirmePage() {
  redirect("/register");
}

