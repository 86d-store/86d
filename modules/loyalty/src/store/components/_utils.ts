export function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

export function formatPoints(points: number): string {
	return new Intl.NumberFormat("en-US").format(points);
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

const TIER_COLORS: Record<string, { bg: string; text: string; ring: string }> =
	{
		bronze: {
			bg: "bg-amber-100 dark:bg-amber-900/30",
			text: "text-amber-800 dark:text-amber-300",
			ring: "ring-amber-300 dark:ring-amber-700",
		},
		silver: {
			bg: "bg-gray-100 dark:bg-gray-700/40",
			text: "text-gray-700 dark:text-gray-300",
			ring: "ring-gray-300 dark:ring-gray-600",
		},
		gold: {
			bg: "bg-yellow-100 dark:bg-yellow-900/30",
			text: "text-yellow-800 dark:text-yellow-300",
			ring: "ring-yellow-300 dark:ring-yellow-700",
		},
		platinum: {
			bg: "bg-indigo-100 dark:bg-indigo-900/30",
			text: "text-indigo-800 dark:text-indigo-300",
			ring: "ring-indigo-300 dark:ring-indigo-700",
		},
	};

const DEFAULT_TIER_COLOR = {
	bg: "bg-gray-100 dark:bg-gray-800",
	text: "text-gray-700 dark:text-gray-300",
	ring: "ring-gray-300 dark:ring-gray-600",
};

export function getTierColor(tier: string) {
	return TIER_COLORS[tier] ?? DEFAULT_TIER_COLOR;
}
