export function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

export function formatDate(iso: string | Date): string {
	const d = typeof iso === "string" ? new Date(iso) : iso;
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(d);
}

export function formatDateTime(iso: string | Date): string {
	const d = typeof iso === "string" ? new Date(iso) : iso;
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	}).format(d);
}

/**
 * Compute the time remaining until `endsAt`.
 * Returns an object with days, hours, minutes, seconds.
 * All values are 0 when the deadline has passed.
 */
export function getTimeRemaining(endsAt: string | Date): {
	total: number;
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	expired: boolean;
} {
	const end =
		typeof endsAt === "string" ? new Date(endsAt).getTime() : endsAt.getTime();
	const total = Math.max(0, end - Date.now());

	if (total <= 0) {
		return {
			total: 0,
			days: 0,
			hours: 0,
			minutes: 0,
			seconds: 0,
			expired: true,
		};
	}

	return {
		total,
		days: Math.floor(total / (1000 * 60 * 60 * 24)),
		hours: Math.floor((total / (1000 * 60 * 60)) % 24),
		minutes: Math.floor((total / (1000 * 60)) % 60),
		seconds: Math.floor((total / 1000) % 60),
		expired: false,
	};
}
