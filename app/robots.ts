import type { MetadataRoute } from "next";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sinpelosenelmicrofono.com").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/login", "/register", "/reset", "/perfil"]
      }
    ],
    sitemap: [`${siteUrl}/sitemap.xml`],
    host: siteUrl
  };
}

