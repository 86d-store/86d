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
	pending:
		"bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
	processing: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
	on_hold:
		"bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
	completed:
		"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
	cancelled: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
	refunded:
		"bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
};

export const PAYMENT_STYLES: Record<string, string> = {
	unpaid: "bg-gray-50 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
	paid: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
	partially_paid:
		"bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
	refunded:
		"bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
	voided: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export const FULFILLMENT_STYLES: Record<string, string> = {
	pending:
		"bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
	shipped: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
	in_transit:
		"bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
	delivered:
		"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
	failed: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
};

export const RETURN_STATUS_STYLES: Record<string, string> = {
	requested:
		"bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200",
	approved: "bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
	rejected: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
	shipped_back:
		"bg-indigo-50 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
	received:
		"bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
	refunded:
		"bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
	completed: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
};
