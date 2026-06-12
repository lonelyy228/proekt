import type { MetadataRoute } from "next";
import { env } from "@/config/env";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = new URL(env.APP_URL);

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/catalog", "/catalog/basics", "/product/", "/delivery", "/returns", "/contacts", "/privacy", "/terms", "/offer"],
        disallow: ["/admin", "/api/", "/profile", "/cart", "/checkout", "/favorites"]
      }
    ],
    sitemap: `${siteUrl.origin}/sitemap.xml`,
    host: siteUrl.origin
  };
}
