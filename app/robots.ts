import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    // a conta pede login e a API não é página
    rules: { userAgent: "*", allow: "/", disallow: ["/conta", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
