export function formatPrice(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}

export function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

export function intervalLabel(interval: string, count: number): string {
	if (count === 1) return interval;
	return `${count} ${interval}s`;
}

export function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

export const STATUS_STYLES: Record<string, string> = {
	active:
		"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
	trialing: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
	cancelled: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
	expired: "bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
	past_due:
		"bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
};
