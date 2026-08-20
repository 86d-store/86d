export function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
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

export function collectAttributeKeys(
	items: Array<{ attributes?: Record<string, string> }>,
): string[] {
	const keys = new Set<string>();
	for (const item of items) {
		if (item.attributes) {
			for (const key of Object.keys(item.attributes)) {
				keys.add(key);
			}
		}
	}
	return Array.from(keys).sort();
}
