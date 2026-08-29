export function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

export function formatCurrency(amount: number, currency: string): string {
	const normalizedCurrency = currency.trim().toUpperCase();
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: normalizedCurrency,
		}).format(amount);
	} catch {
		const formattedAmount = new Intl.NumberFormat("en-US", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(amount);
		return normalizedCurrency
			? `${formattedAmount} ${normalizedCurrency}`
			: `${formattedAmount} Unknown currency`;
	}
}
