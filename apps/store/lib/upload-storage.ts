const PUBLIC_UPLOAD_PREFIX = "/uploads/";

export function isProxyingUploadUrls(): boolean {
	return (process.env.STORAGE_PUBLIC_URL_MODE ?? "direct") === "proxy";
}

export function buildPublicUploadUrl(key: string): string {
	return `${PUBLIC_UPLOAD_PREFIX}${key}`;
}

export function normalizeUploadKey(value: string): string {
	let normalized = value.trim();
	if (!normalized) return "";

	if (/^https?:\/\//i.test(normalized)) {
		try {
			normalized = new URL(normalized).pathname;
		} catch {
			return "";
		}
	}

	if (normalized.startsWith(PUBLIC_UPLOAD_PREFIX)) {
		return normalized.slice(PUBLIC_UPLOAD_PREFIX.length);
	}

	if (normalized.startsWith("/")) {
		return "";
	}

	return normalized;
}

export function hasInvalidUploadKey(key: string): boolean {
	return (
		!key ||
		key.includes("\0") ||
		key
			.split("/")
			.some((segment) => !segment || segment === "." || segment === "..")
	);
}
