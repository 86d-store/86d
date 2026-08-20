import type { MetadataRoute } from "next";
import { getBaseUrl } from "utils/url";

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
