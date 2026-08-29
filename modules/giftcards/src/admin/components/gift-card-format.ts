const TRANSACTION_LABELS: Readonly<Record<string, string>> = {
	debit: "Debit",
	credit: "Credit",
	purchase: "Purchase",
	topup: "Top-up",
};

export function formatGiftCardDate(iso: string): string {
	const date = new Date(iso);
	if (!Number.isFinite(date.getTime())) return "Unknown date";
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	}).format(date);
}

export function formatGiftCardCurrency(
	amount: number,
	currency: string,
): string {
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

export function formatLegacyGiftCardValue(value: string): string {
	const readable = value.trim().replaceAll(/[-_]+/g, " ");
	if (!readable) return "Unknown";
	return `${readable.charAt(0).toUpperCase()}${readable.slice(1)}`;
}

export function formatGiftCardTransactionType(type: string): string {
	return TRANSACTION_LABELS[type] ?? formatLegacyGiftCardValue(type);
}
