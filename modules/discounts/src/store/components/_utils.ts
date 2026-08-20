export function formatCents(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

export function formatDiscountValue(type: string, value: number): string {
	switch (type) {
		case "percentage":
			return `${value}% OFF`;
		case "fixed_amount":
			return `${formatCents(value)} OFF`;
		case "free_shipping":
			return "FREE SHIPPING";
		default:
			return "SALE";
	}
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
