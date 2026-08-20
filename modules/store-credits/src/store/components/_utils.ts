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
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency,
	}).format(amount);
}

const reasonLabels: Record<string, string> = {
	return_refund: "Return Refund",
	order_payment: "Order Payment",
	admin_adjustment: "Admin Adjustment",
	referral_reward: "Referral Reward",
	gift_card_conversion: "Gift Card Conversion",
	promotional: "Promotional Credit",
	other: "Other",
};

export function formatReason(reason: string): string {
	return reasonLabels[reason] ?? reason;
}

export function formatDate(date: string | Date): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(typeof date === "string" ? new Date(date) : date);
}
