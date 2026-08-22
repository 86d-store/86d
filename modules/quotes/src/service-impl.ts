import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Quote,
	QuoteComment,
	QuoteController,
	QuoteHistory,
	QuoteItem,
	QuoteStats,
	QuoteStatus,
} from "./service";

function recalculateTotals(items: QuoteItem[]): {
	subtotal: number;
	total: number;
} {
	const subtotal = items.reduce((sum, item) => {
		const price = item.offeredPrice ?? item.unitPrice;
		return sum + price * item.quantity;
	}, 0);
	return { subtotal, total: subtotal };
}

async function recordStatusChange(
	data: ModuleDataService,
	quoteId: string,
	fromStatus: string,
	toStatus: string,
	changedBy: string,
	reason?: string,
): Promise<void> {
	const historyId = crypto.randomUUID();
	await data.upsert("quoteHistory", historyId, {
		id: historyId,
		quoteId,
		fromStatus,
		toStatus,
		changedBy,
		reason: reason ?? "",
		createdAt: new Date(),
	} as Record<string, unknown>);
}

export function createQuoteController(
	data: ModuleDataService,
	options: { defaultExpirationDays: number },
): QuoteController {
	return {
		// ── Quote lifecycle ──

		async createQuote(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const quote = {
				id,
				customerId: params.customerId,
				customerEmail: params.customerEmail,
				customerName: params.customerName,
				companyName: params.companyName ?? "",
				status: "draft" as const,
				notes: params.notes ?? "",
				adminNotes: "",
				subtotal: 0,
				discount: 0,
				total: 0,
				convertedOrderId: "",
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				quote as unknown as Record<string, unknown>,
			);
			return quote as unknown as Quote;
		},

		async getQuote(id) {
			return (await data.get("quote", id)) as Quote | null;
		},

		async getMyQuotes(params) {
			const where: Record<string, unknown> = {
				customerId: params.customerId,
			};
			if (params.status) {
				where.status = params.status;
			}
			const query: Record<string, unknown> = { where };
			if (params.skip != null) query.skip = params.skip;
			if (params.take != null) query.take = params.take;
			return (await data.findMany(
				"quote",
				query as { where?: Record<string, unknown> },
			)) as Quote[];
		},

		async submitQuote(id) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (quote?.status !== "draft") return null;

			const items = (await data.findMany("quoteItem", {
				where: { quoteId: id },
			})) as QuoteItem[];
			if (items.length === 0) return null;

			const now = new Date();
			const updated = {
				...quote,
				status: "submitted" as const,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				updated as unknown as Record<string, unknown>,
			);
			await recordStatusChange(
				data,
				id,
				"draft",
				"submitted",
				quote.customerId,
			);
			return updated as unknown as Quote;
		},

		async acceptQuote(id) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (quote?.status !== "countered") return null;

			if (quote.expiresAt && new Date() > new Date(quote.expiresAt)) {
				return null;
			}

			const now = new Date();
			const updated = {
				...quote,
				status: "accepted" as const,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				updated as unknown as Record<string, unknown>,
			);
			await recordStatusChange(
				data,
				id,
				"countered",
				"accepted",
				quote.customerId,
			);
			return updated as unknown as Quote;
		},

		async declineQuote(id, reason) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (quote?.status !== "countered") return null;

			const now = new Date();
			const updated = {
				...quote,
				status: "rejected" as const,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				updated as unknown as Record<string, unknown>,
			);
			await recordStatusChange(
				data,
				id,
				"countered",
				"rejected",
				quote.customerId,
				reason,
			);
			return updated as unknown as Quote;
		},

		// ── Items ──

		async addItem(params) {
			const quote = (await data.get("quote", params.quoteId)) as Quote | null;
			if (quote?.status !== "draft") return null;

			const itemId = crypto.randomUUID();
			const now = new Date();
			const item = {
				id: itemId,
				quoteId: params.quoteId,
				productId: params.productId,
				productName: params.productName,
				sku: params.sku ?? "",
				quantity: params.quantity,
				unitPrice: params.unitPrice,
				notes: params.notes ?? "",
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"quoteItem",
				itemId,
				item as unknown as Record<string, unknown>,
			);

			// Recalculate quote totals
			const allItems = (await data.findMany("quoteItem", {
				where: { quoteId: params.quoteId },
			})) as QuoteItem[];
			const totals = recalculateTotals(allItems);
			await data.upsert("quote", params.quoteId, {
				...quote,
				...totals,
				updatedAt: now,
			} as unknown as Record<string, unknown>);

			return item as unknown as QuoteItem;
		},

		async updateItem(quoteId, itemId, params) {
			const quote = (await data.get("quote", quoteId)) as Quote | null;
			if (quote?.status !== "draft") return null;

			const item = (await data.get("quoteItem", itemId)) as QuoteItem | null;
			if (!item || item.quoteId !== quoteId) return null;

			const now = new Date();
			const updated = {
				...item,
				quantity: params.quantity ?? item.quantity,
				unitPrice: params.unitPrice ?? item.unitPrice,
				notes: params.notes ?? item.notes,
				updatedAt: now,
			};
			await data.upsert(
				"quoteItem",
				itemId,
				updated as unknown as Record<string, unknown>,
			);

			const allItems = (await data.findMany("quoteItem", {
				where: { quoteId },
			})) as QuoteItem[];
			const totals = recalculateTotals(allItems);
			await data.upsert("quote", quoteId, {
				...quote,
				...totals,
				updatedAt: now,
			} as unknown as Record<string, unknown>);

			return updated as unknown as QuoteItem;
		},

		async removeItem(quoteId, itemId) {
			const quote = (await data.get("quote", quoteId)) as Quote | null;
			if (quote?.status !== "draft") return false;

			const item = (await data.get("quoteItem", itemId)) as QuoteItem | null;
			if (!item || item.quoteId !== quoteId) return false;

			await data.delete("quoteItem", itemId);

			const now = new Date();
			const allItems = (await data.findMany("quoteItem", {
				where: { quoteId },
			})) as QuoteItem[];
			const totals = recalculateTotals(allItems);
			await data.upsert("quote", quoteId, {
				...quote,
				...totals,
				updatedAt: now,
			} as unknown as Record<string, unknown>);

			return true;
		},

		async getItems(quoteId) {
			return (await data.findMany("quoteItem", {
				where: { quoteId },
			})) as QuoteItem[];
		},

		// ── Comments ──

		async addComment(params) {
			const id = crypto.randomUUID();
			const comment = {
				id,
				quoteId: params.quoteId,
				authorType: params.authorType,
				authorId: params.authorId,
				authorName: params.authorName,
				message: params.message,
				createdAt: new Date(),
			};
			await data.upsert(
				"quoteComment",
				id,
				comment as unknown as Record<string, unknown>,
			);
			return comment as unknown as QuoteComment;
		},

		async getComments(quoteId) {
			return (await data.findMany("quoteComment", {
				where: { quoteId },
			})) as QuoteComment[];
		},

		// ── Admin operations ──

		async listQuotes(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) {
				where.status = params.status;
			}
			if (params?.customerId) {
				where.customerId = params.customerId;
			}
			const query: Record<string, unknown> = { where };
			if (params?.skip != null) query.skip = params.skip;
			if (params?.take != null) query.take = params.take;
			return (await data.findMany(
				"quote",
				query as { where?: Record<string, unknown> },
			)) as Quote[];
		},

		async reviewQuote(id) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (quote?.status !== "submitted") return null;

			const now = new Date();
			const updated = {
				...quote,
				status: "under_review" as const,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				updated as unknown as Record<string, unknown>,
			);
			await recordStatusChange(data, id, "submitted", "under_review", "admin");
			return updated as unknown as Quote;
		},

		async counterQuote(id, params) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (
				!quote ||
				(quote.status !== "submitted" && quote.status !== "under_review")
			) {
				return null;
			}

			// Apply offered prices to items
			for (const itemUpdate of params.items) {
				const item = (await data.get(
					"quoteItem",
					itemUpdate.itemId,
				)) as QuoteItem | null;
				if (item && item.quoteId === id) {
					await data.upsert("quoteItem", itemUpdate.itemId, {
						...item,
						offeredPrice: itemUpdate.offeredPrice,
						updatedAt: new Date(),
					} as unknown as Record<string, unknown>);
				}
			}

			// Recalculate with offered prices
			const allItems = (await data.findMany("quoteItem", {
				where: { quoteId: id },
			})) as QuoteItem[];
			const totals = recalculateTotals(allItems);

			const expiresAt =
				params.expiresAt ??
				new Date(
					Date.now() + options.defaultExpirationDays * 24 * 60 * 60 * 1000,
				);

			const now = new Date();
			const updated = {
				...quote,
				...totals,
				status: "countered" as const,
				adminNotes: params.adminNotes ?? quote.adminNotes,
				expiresAt,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				updated as unknown as Record<string, unknown>,
			);
			await recordStatusChange(data, id, quote.status, "countered", "admin");
			return updated as unknown as Quote;
		},

		async approveAsIs(id, params) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (
				!quote ||
				(quote.status !== "submitted" && quote.status !== "under_review")
			) {
				return null;
			}

			const expiresAt =
				params?.expiresAt ??
				new Date(
					Date.now() + options.defaultExpirationDays * 24 * 60 * 60 * 1000,
				);

			const now = new Date();
			const updated = {
				...quote,
				status: "countered" as const,
				adminNotes: params?.adminNotes ?? quote.adminNotes,
				expiresAt,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				updated as unknown as Record<string, unknown>,
			);
			await recordStatusChange(data, id, quote.status, "countered", "admin");
			return updated as unknown as Quote;
		},

		async rejectQuote(id, reason) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (!quote) return null;

			const terminalStatuses: QuoteStatus[] = [
				"rejected",
				"expired",
				"converted",
			];
			if (terminalStatuses.includes(quote.status)) return null;

			const now = new Date();
			const updated = {
				...quote,
				status: "rejected" as const,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				updated as unknown as Record<string, unknown>,
			);
			await recordStatusChange(
				data,
				id,
				quote.status,
				"rejected",
				"admin",
				reason,
			);
			return updated as unknown as Quote;
		},

		async convertToOrder(id, orderId) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (quote?.status !== "accepted") return null;

			const now = new Date();
			const updated = {
				...quote,
				status: "converted" as const,
				convertedOrderId: orderId,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				updated as unknown as Record<string, unknown>,
			);
			await recordStatusChange(data, id, "accepted", "converted", "admin");
			return updated as unknown as Quote;
		},

		async expireQuote(id) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (quote?.status !== "countered") return null;

			const now = new Date();
			const updated = {
				...quote,
				status: "expired" as const,
				updatedAt: now,
			};
			await data.upsert(
				"quote",
				id,
				updated as unknown as Record<string, unknown>,
			);
			await recordStatusChange(data, id, "countered", "expired", "system");
			return updated as unknown as Quote;
		},

		// ── Admin delete ──

		async deleteQuote(id) {
			const quote = (await data.get("quote", id)) as Quote | null;
			if (!quote) return false;
			await data.delete("quote", id);
			return true;
		},

		// ── History ──

		async getHistory(quoteId) {
			return (await data.findMany("quoteHistory", {
				where: { quoteId },
			})) as QuoteHistory[];
		},

		// ── Stats ──

		async getStats() {
			const allQuotes = (await data.findMany("quote", {})) as Quote[];

			const stats: QuoteStats = {
				totalQuotes: allQuotes.length,
				draftQuotes: 0,
				submittedQuotes: 0,
				underReviewQuotes: 0,
				counteredQuotes: 0,
				acceptedQuotes: 0,
				rejectedQuotes: 0,
				expiredQuotes: 0,
				convertedQuotes: 0,
				totalValue: 0,
				averageValue: 0,
				conversionRate: 0,
			};

			for (const q of allQuotes) {
				switch (q.status) {
					case "draft":
						stats.draftQuotes++;
						break;
					case "submitted":
						stats.submittedQuotes++;
						break;
					case "under_review":
						stats.underReviewQuotes++;
						break;
					case "countered":
						stats.counteredQuotes++;
						break;
					case "accepted":
						stats.acceptedQuotes++;
						break;
					case "rejected":
						stats.rejectedQuotes++;
						break;
					case "expired":
						stats.expiredQuotes++;
						break;
					case "converted":
						stats.convertedQuotes++;
						break;
				}
				stats.totalValue += q.total;
			}

			if (allQuotes.length > 0) {
				stats.averageValue = stats.totalValue / allQuotes.length;
			}

			const completedQuotes = stats.acceptedQuotes + stats.convertedQuotes;
			const decidedQuotes =
				completedQuotes + stats.rejectedQuotes + stats.expiredQuotes;
			if (decidedQuotes > 0) {
				stats.conversionRate = completedQuotes / decidedQuotes;
			}

			return stats;
		},
	};
}
