declare const window: { location: { origin: string } } | undefined;

export function getBaseUrl(): string {
	if (typeof window !== "undefined") {
		return window.location.origin;
	}

	if (process.env.NEXT_PUBLIC_STORE_URL) {
		return process.env.NEXT_PUBLIC_STORE_URL;
	}

	if (process.env.RAILWAY_PUBLIC_DOMAIN) {
		return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
	}

	if (process.env.VERCEL_URL) {
		return `https://${process.env.VERCEL_URL}`;
	}

	return `http://localhost:${process.env.PORT ?? 3000}`;
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
