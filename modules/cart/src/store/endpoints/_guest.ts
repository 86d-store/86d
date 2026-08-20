const COOKIE_NAME = "cart_guest_id";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days

interface CookieCtx {
	getCookie: (key: string) => string | null;
	setCookie: (
		key: string,
		value: string,
		options?: Record<string, unknown>,
	) => string;
}

/**
 * Resolve a stable guest cart identifier from a cookie.
 * If the cookie doesn't exist yet, generates a new UUID and sets it.
 */
export function resolveGuestId(ctx: CookieCtx): string {
	const existing = ctx.getCookie(COOKIE_NAME);
	if (existing) return existing;

	const id = crypto.randomUUID();
	ctx.setCookie(COOKIE_NAME, id, {
		httpOnly: true,
		sameSite: "lax" as const,
		path: "/",
		maxAge: COOKIE_MAX_AGE,
	});
	return id;
}
