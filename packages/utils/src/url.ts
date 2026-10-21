import { getProcessEnv } from "env/process-env";

declare const window: { location: { origin: string } } | undefined;

/**
 * Resolve the Store's public base URL.
 *
 * Priority (server-side):
 * 1. NEXT_PUBLIC_STORE_URL — deprecated fallback override for existing deployments
 * 2. APP_URL — canonical public base URL
 * 3. RAILWAY_PUBLIC_DOMAIN — auto-detected Railway deployment
 * 4. VERCEL_URL — auto-detected Vercel deployment
 * 5. http://localhost:PORT — local development default
 *
 * Client-side always returns `window.location.origin`.
 *
 * Note: NEXT_PUBLIC_STORE_URL takes precedence to preserve backward compatibility
 * for existing deployments that set it explicitly. New deployments should use
 * APP_URL only.
 */
export function getBaseUrl(): string {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}

	const nextPublicStoreUrl = getProcessEnv("NEXT_PUBLIC_STORE_URL");
	if (nextPublicStoreUrl) {
		return nextPublicStoreUrl;
	}

	const appUrl = getProcessEnv("APP_URL");
	if (appUrl) {
		return appUrl;
	}

	const railwayDomain = getProcessEnv("RAILWAY_PUBLIC_DOMAIN");
	if (railwayDomain) {
		return `https://${railwayDomain}`;
	}

	const vercelUrl = getProcessEnv("VERCEL_URL");
	if (vercelUrl) {
		return `https://${vercelUrl}`;
	}

	return `http://localhost:${getProcessEnv("PORT") ?? 3000}`;
}

/**
 * Ensures a public storefront/deployment URL is absolute for use in `href`.
 * Railway (and some APIs) return bare hostnames like `svc.up.railway.app`.
 */
export function ensureHttpsUrl(url: string | null | undefined): string | null {
	if (url == null) return null;
	const t = url.trim();
	if (!t) return null;
	if (/^[a-z][a-z0-9+.-]*:/iu.test(t)) {
		return t;
	}
	return `https://${t}`;
}

/** Host (or best-effort label) for displaying a URL that already includes a scheme. */
export function httpsUrlHostLabel(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url.replace(/^https?:\/\//iu, "");
	}
}
