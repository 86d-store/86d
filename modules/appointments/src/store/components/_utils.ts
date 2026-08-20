export function formatDateTime(dateStr: string | Date): string {
	return new Date(dateStr).toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function formatDate(dateStr: string | Date): string {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function formatTime(dateStr: string | Date): string {
	return new Date(dateStr).toLocaleTimeString(undefined, {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function formatCurrency(amount: number, currency = "USD"): string {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(amount / 100);
}

export function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function extractError(
	error: unknown,
	fallback = "Something went wrong",
): string {
	if (!error) return fallback;
	const err = error as {
		body?: { error?: string | { message?: string } };
		message?: string;
	};
	if (typeof err.body?.error === "string") return err.body.error;
	if (typeof err.body?.error?.message === "string")
		return err.body.error.message;
	if (typeof err.message === "string") return err.message;
	return fallback;
}

export function isoDate(date: Date): string {
	return date.toISOString().split("T")[0] as string;
}

export const STATUS_LABELS: Record<string, string> = {
	pending: "Pending",
	confirmed: "Confirmed",
	cancelled: "Cancelled",
	completed: "Completed",
	"no-show": "No Show",
};

export const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	"no-show": "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};
