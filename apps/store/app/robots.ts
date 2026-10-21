import type { MetadataRoute } from "next";
import { getBaseUrl } from "utils/url";

/**
 * Force dynamic rendering so the base URL is read from NEXT_PUBLIC_STORE_URL
 * at request time, not baked in at build time (when the Dockerfile builder stage
 * doesn't have the runtime env).
 */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
	const url = getBaseUrl();

	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: ["/admin/", "/api/", "/auth/", "/_next/", "/_vercel/"],
			},
			{
				userAgent: [
					"ChatGPT-User",
					"GPTBot",
					"Google-Extended",
					"anthropic-ai",
					"ClaudeBot",
					"PerplexityBot",
					"Applebot-Extended",
				],
				allow: ["/", "/llms.txt", "/llms-full.txt"],
			},
		],
		sitemap: `${url}/sitemap.xml`,
	};
}
