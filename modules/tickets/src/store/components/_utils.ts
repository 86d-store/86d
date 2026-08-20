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

export function statusColor(status: string): string {
	switch (status) {
		case "open":
			return "bg-blue-100 text-blue-800";
		case "in_progress":
			return "bg-yellow-100 text-yellow-800";
		case "resolved":
			return "bg-green-100 text-green-800";
		case "closed":
			return "bg-gray-100 text-gray-800";
		default:
			return "bg-gray-100 text-gray-800";
	}
}

export function priorityColor(priority: string): string {
	switch (priority) {
		case "urgent":
			return "text-red-600";
		case "high":
			return "text-orange-600";
		case "normal":
			return "text-blue-600";
		case "low":
			return "text-gray-600";
		default:
			return "text-gray-600";
	}
}
