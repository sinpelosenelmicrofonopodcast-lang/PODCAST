import type { MetadataRoute } from "next";
import { CANONICAL_SITE_URL } from "@/lib/seo/constants";

const siteUrl = CANONICAL_SITE_URL;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/entrar", "/unirme", "/community", "/comunidad", "/zona-cruda", "/dashboard", "/admin", "/api"]
      }
    ],
    sitemap: [`${siteUrl}/sitemap.xml`],
    host: siteUrl
  };
}
