export function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

export function formatCurrency(amount: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(amount / 100);
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

export function statusLabel(status: string): string {
	const labels: Record<string, string> = {
		draft: "Draft",
		submitted: "Submitted",
		under_review: "Under Review",
		countered: "Countered",
		accepted: "Accepted",
		rejected: "Rejected",
		expired: "Expired",
		converted: "Converted",
	};
	return labels[status] ?? status;
}

export function statusColor(status: string): string {
	switch (status) {
		case "draft":
			return "bg-gray-100 text-gray-800";
		case "submitted":
			return "bg-blue-100 text-blue-800";
		case "under_review":
			return "bg-yellow-100 text-yellow-800";
		case "countered":
			return "bg-purple-100 text-purple-800";
		case "accepted":
			return "bg-green-100 text-green-800";
		case "rejected":
			return "bg-red-100 text-red-800";
		case "expired":
			return "bg-gray-100 text-gray-600";
		case "converted":
			return "bg-emerald-100 text-emerald-800";
		default:
			return "bg-gray-100 text-gray-800";
	}
}
