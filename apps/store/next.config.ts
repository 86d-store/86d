import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import createMDX from "@next/mdx";
import { withSentryConfig } from "@sentry/nextjs";
import env from "env";
import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

/**
 * Read the auto-generated transpile packages list.
 * Falls back to empty array if the file hasn't been generated yet.
 */
function loadTranspilePackages(): string[] {
	const filePath = join(
		import.meta.dirname,
		"generated",
		"transpile-packages.json",
	);
	if (!existsSync(filePath)) return [];
	try {
		return JSON.parse(readFileSync(filePath, "utf-8"));
	} catch {
		return [];
	}
}

const isVercelProduction = process.env.VERCEL_ENV === "production";

const cspDirectives = [
	"default-src 'self'",
	// Next.js requires unsafe-inline and unsafe-eval for its runtime
	`script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com${
		isVercelProduction ? " https://va.vercel-scripts.com" : ""
	}`,
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: https: blob:",
	"font-src 'self'",
	"connect-src 'self' https://vitals.vercel-insights.com https://www.google-analytics.com https://*.ingest.sentry.io https:",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
].join("; ");

const securityHeaders = [
	{ key: "X-Frame-Options", value: "DENY" },
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
	{ key: "X-DNS-Prefetch-Control", value: "on" },
	{
		key: "Strict-Transport-Security",
		value: "max-age=63072000; includeSubDomains; preload",
	},
	{
		key: "Permissions-Policy",
		value: "camera=(), microphone=(), geolocation=()",
	},
	{
		key: "Content-Security-Policy",
		value: cspDirectives,
	},
];

const withMDX = createMDX({});

const nextConfig = withMDX({
	...(process.env.DOCKER_BUILD === "true"
		? { output: "standalone" as const }
		: {}),
	pageExtensions: ["js", "jsx", "md", "mdx", "ts", "tsx"],
	transpilePackages: [...loadTranspilePackages(), "@86d-app/storage"],
	turbopack: {
		rules: {
			"*.txt": {
				loaders: ["raw-loader"],
				as: "*.js",
			},
		},
	},
	images: {
		remotePatterns: [
			...(env.VERCEL_BLOB_STORAGE_HOSTNAME
				? [
						{
							protocol: "https",
							hostname: env.VERCEL_BLOB_STORAGE_HOSTNAME,
						} satisfies RemotePattern,
					]
				: []),
		],
	},
	async headers() {
		return [{ source: "/:path*", headers: securityHeaders }];
	},
} satisfies NextConfig);

export default withSentryConfig(nextConfig, {
	silent: true,
	sourcemaps: { disable: true },
});
