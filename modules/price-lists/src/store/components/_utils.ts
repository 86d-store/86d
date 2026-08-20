export function formatCurrency(cents: number, currency = "USD"): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(cents / 100);
}
