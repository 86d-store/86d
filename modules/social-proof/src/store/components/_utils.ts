export function timeAgo(date: Date | string): string {
	const now = Date.now();
	const then = new Date(date).getTime();
	const diffMs = now - then;
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay < 30) return `${diffDay}d ago`;
	return new Date(date).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
	});
}

export function formatCount(count: number): string {
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
	}
	return String(count);
}

export function extractError(error: unknown, fallback: string): string {
	if (error && typeof error === "object" && "body" in error) {
		const body = (error as Record<string, unknown>).body;
		if (body && typeof body === "object" && "error" in body) {
			return String((body as Record<string, unknown>).error);
		}
	}
	if (error instanceof Error) return error.message;
	return fallback;
}
