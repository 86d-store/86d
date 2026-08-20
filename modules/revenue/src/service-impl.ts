import type {
	PaymentIntentStatus,
	RevenueIntent,
	RevenueStats,
	RevenueTransaction,
} from "./service";

export function aggregateStats(
	intents: RevenueIntent[],
	from: Date | null,
	to: Date | null,
): RevenueStats {
	const filtered = intents.filter((i) => {
		const t = new Date(i.createdAt);
		if (from && t < from) return false;
		if (to && t > to) return false;
		return true;
	});

	const byStatus: Record<PaymentIntentStatus, number> = {
		pending: 0,
		processing: 0,
		succeeded: 0,
		failed: 0,
		cancelled: 0,
		refunded: 0,
	};

	let totalVolume = 0;
	let refundVolume = 0;
	let refundCount = 0;
	let currency = "USD";

	for (const intent of filtered) {
		const s = intent.status as PaymentIntentStatus;
		if (s in byStatus) byStatus[s]++;
		if (s === "succeeded") {
			totalVolume += intent.amount;
			currency = intent.currency;
		}
		if (s === "refunded") {
			refundVolume += intent.amount;
			refundCount++;
		}
	}

	const succeededCount = byStatus.succeeded;
	return {
		totalVolume,
		transactionCount: succeededCount,
		averageValue: succeededCount > 0 ? totalVolume / succeededCount : 0,
		currency,
		byStatus,
		refundVolume,
		refundCount,
	};
}

export function filterAndPageTransactions(
	intents: RevenueIntent[],
	opts: {
		from: Date | null;
		to: Date | null;
		status?: PaymentIntentStatus | undefined;
		search?: string | undefined;
		page: number;
		limit: number;
	},
): { transactions: RevenueTransaction[]; total: number } {
	const search = opts.search?.toLowerCase();

	const filtered = intents.filter((i) => {
		const t = new Date(i.createdAt);
		if (opts.from && t < opts.from) return false;
		if (opts.to && t > opts.to) return false;
		if (opts.status && i.status !== opts.status) return false;
		if (search) {
			const hay = [i.id, i.providerIntentId, i.email, i.customerId, i.orderId]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			if (!hay.includes(search)) return false;
		}
		return true;
	});

	filtered.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	const skip = (opts.page - 1) * opts.limit;
	const paged = filtered.slice(skip, skip + opts.limit);

	const transactions: RevenueTransaction[] = paged.map((i) => ({
		id: i.id,
		providerIntentId: i.providerIntentId,
		email: i.email,
		customerId: i.customerId,
		orderId: i.orderId,
		amount: i.amount,
		currency: i.currency,
		status: i.status as PaymentIntentStatus,
		createdAt: new Date(i.createdAt),
		updatedAt: new Date(i.updatedAt),
	}));

	return { transactions, total: filtered.length };
}

export function escapeCSV(value: string | number | undefined | null): string {
	if (value === null || value === undefined) return "";
	const str = String(value);
	if (str.includes(",") || str.includes('"') || str.includes("\n")) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

export function buildCSV(intents: RevenueIntent[]): string {
	const header =
		"Date,Transaction ID,Status,Amount,Currency,Customer Email,Order ID,Provider ID";
	const rows = intents.map((i) => {
		const amount = (i.amount / 100).toFixed(2);
		return [
			escapeCSV(new Date(i.createdAt).toISOString()),
			escapeCSV(i.id),
			escapeCSV(i.status),
			escapeCSV(amount),
			escapeCSV(i.currency),
			escapeCSV(i.email),
			escapeCSV(i.orderId),
			escapeCSV(i.providerIntentId),
		].join(",");
	});
	return [header, ...rows].join("\n");
}
