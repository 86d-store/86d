import { describe, expect, it, vi } from "vitest";
import { addCommentAdminEndpoint } from "../admin/endpoints/add-comment";
import { addItemEndpoint } from "../admin/endpoints/add-item";
import { approveQuoteEndpoint } from "../admin/endpoints/approve-quote";
import { convertToOrderEndpoint } from "../admin/endpoints/convert-to-order";
import { counterQuoteEndpoint } from "../admin/endpoints/counter-quote";
import { createQuoteEndpoint } from "../admin/endpoints/create-quote";
import { deleteQuoteEndpoint } from "../admin/endpoints/delete-quote";
import { expireQuoteEndpoint } from "../admin/endpoints/expire-quote";
import { getQuoteAdminEndpoint } from "../admin/endpoints/get-quote";
import { listQuotesEndpoint } from "../admin/endpoints/list-quotes";
import { rejectQuoteEndpoint } from "../admin/endpoints/reject-quote";
import { removeItemEndpoint } from "../admin/endpoints/remove-item";
import { reviewQuoteEndpoint } from "../admin/endpoints/review-quote";
import { statsEndpoint } from "../admin/endpoints/stats";
import { updateItemEndpoint } from "../admin/endpoints/update-item";
import type {
	Quote,
	QuoteComment,
	QuoteController,
	QuoteItem,
	QuoteStats,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		customerId: "cust_1",
		customerEmail: "buyer@example.com",
		customerName: "Alice Smith",
		status: "draft",
		subtotal: 10000,
		discount: 0,
		total: 10000,
		metadata: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeItem(overrides: Partial<QuoteItem> = {}): QuoteItem {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		quoteId: "q1",
		productId: "prod_1",
		productName: "Widget Pro",
		quantity: 2,
		unitPrice: 5000,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeComment(overrides: Partial<QuoteComment> = {}): QuoteComment {
	return {
		id: crypto.randomUUID(),
		quoteId: "q1",
		authorType: "admin",
		authorId: "admin_1",
		authorName: "Support",
		message: "Reviewing your request",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<QuoteController> = {},
): QuoteController {
	return {
		createQuote: vi.fn().mockResolvedValue(makeQuote()),
		getQuote: vi.fn().mockResolvedValue(null),
		getMyQuotes: vi.fn().mockResolvedValue([]),
		submitQuote: vi.fn().mockResolvedValue(null),
		acceptQuote: vi.fn().mockResolvedValue(null),
		declineQuote: vi.fn().mockResolvedValue(null),
		addItem: vi.fn().mockResolvedValue(makeItem()),
		updateItem: vi.fn().mockResolvedValue(null),
		removeItem: vi.fn().mockResolvedValue(false),
		getItems: vi.fn().mockResolvedValue([]),
		addComment: vi.fn().mockResolvedValue(makeComment()),
		getComments: vi.fn().mockResolvedValue([]),
		listQuotes: vi.fn().mockResolvedValue([]),
		reviewQuote: vi.fn().mockResolvedValue(null),
		counterQuote: vi.fn().mockResolvedValue(null),
		approveAsIs: vi.fn().mockResolvedValue(null),
		rejectQuote: vi.fn().mockResolvedValue(null),
		convertToOrder: vi.fn().mockResolvedValue(null),
		expireQuote: vi.fn().mockResolvedValue(null),
		deleteQuote: vi.fn().mockResolvedValue(false),
		getHistory: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue({
			totalQuotes: 0,
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
		} satisfies QuoteStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: QuoteController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { quotes: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listHandler = extractHandler(listQuotesEndpoint);
const createHandler = extractHandler(createQuoteEndpoint);
const getHandler = extractHandler(getQuoteAdminEndpoint);
const deleteHandler = extractHandler(deleteQuoteEndpoint);
const reviewHandler = extractHandler(reviewQuoteEndpoint);
const approveHandler = extractHandler(approveQuoteEndpoint);
const rejectHandler = extractHandler(rejectQuoteEndpoint);
const counterHandler = extractHandler(counterQuoteEndpoint);
const convertHandler = extractHandler(convertToOrderEndpoint);
const expireHandler = extractHandler(expireQuoteEndpoint);
const addItemHandler = extractHandler(addItemEndpoint);
const updateItemHandler = extractHandler(updateItemEndpoint);
const removeItemHandler = extractHandler(removeItemEndpoint);
const addCommentHandler = extractHandler(addCommentAdminEndpoint);
const statsHandler = extractHandler(statsEndpoint);

// ── listQuotes ────────────────────────────────────────────────────────────────

describe("admin GET /quotes", () => {
	it("returns empty list when no quotes", async () => {
		const result = (await call(listHandler)) as { quotes: Quote[] };
		expect(result.quotes).toHaveLength(0);
	});

	it("returns quotes from controller", async () => {
		const quotes = [makeQuote(), makeQuote()];
		const ctrl = makeController({
			listQuotes: vi.fn().mockResolvedValue(quotes),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			quotes: Quote[];
		};
		expect(result.quotes).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "submitted" },
			controller: ctrl,
		});
		expect(ctrl.listQuotes).toHaveBeenCalledWith(
			expect.objectContaining({ status: "submitted" }),
		);
	});
});

// ── createQuote ───────────────────────────────────────────────────────────────

describe("admin POST /quotes/create", () => {
	it("creates a quote and returns it", async () => {
		const quote = makeQuote({ customerEmail: "b2b@corp.com" });
		const ctrl = makeController({
			createQuote: vi.fn().mockResolvedValue(quote),
		});
		const result = (await call(createHandler, {
			body: {
				customerEmail: "b2b@corp.com",
				customerName: "Corp Buyer",
			},
			controller: ctrl,
		})) as { quote: Quote };
		expect(result.quote.customerEmail).toBe("b2b@corp.com");
	});
});

// ── getQuote ──────────────────────────────────────────────────────────────────

describe("admin GET /quotes/:id", () => {
	it("returns error when quote not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Quote not found");
	});

	it("returns quote with items", async () => {
		const quote = makeQuote({ id: "q1" });
		const items = [makeItem({ quoteId: "q1" })];
		const ctrl = makeController({
			getQuote: vi.fn().mockResolvedValue(quote),
			getItems: vi.fn().mockResolvedValue(items),
		});
		const result = (await call(getHandler, {
			params: { id: "q1" },
			controller: ctrl,
		})) as { quote: Quote; items: QuoteItem[] };
		expect(result.quote.id).toBe("q1");
		expect(result.items).toHaveLength(1);
	});
});

// ── deleteQuote ───────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/delete", () => {
	it("returns error when quote not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Quote not found");
	});

	it("deletes quote and returns success", async () => {
		const ctrl = makeController({
			deleteQuote: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "q1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.deleteQuote).toHaveBeenCalledWith("q1");
	});
});

// ── reviewQuote ───────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/review", () => {
	it("returns error when quote cannot be reviewed", async () => {
		const result = (await call(reviewHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Cannot review this quote");
	});

	it("moves quote to under_review status", async () => {
		const quote = makeQuote({ status: "under_review" });
		const ctrl = makeController({
			reviewQuote: vi.fn().mockResolvedValue(quote),
		});
		const result = (await call(reviewHandler, {
			params: { id: quote.id },
			controller: ctrl,
		})) as { quote: Quote };
		expect(result.quote.status).toBe("under_review");
	});
});

// ── approveQuote ──────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/approve", () => {
	it("returns error when quote not found", async () => {
		const result = (await call(approveHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("approves quote and returns it", async () => {
		const quote = makeQuote({ status: "accepted" });
		const ctrl = makeController({
			approveAsIs: vi.fn().mockResolvedValue(quote),
		});
		const result = (await call(approveHandler, {
			params: { id: quote.id },
			body: {},
			controller: ctrl,
		})) as { quote: Quote };
		expect(result.quote.status).toBe("accepted");
	});
});

// ── rejectQuote ───────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/reject", () => {
	it("returns error when quote not found", async () => {
		const result = (await call(rejectHandler, {
			params: { id: "missing" },
			body: {},
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("rejects quote with reason", async () => {
		const quote = makeQuote({ status: "rejected" });
		const ctrl = makeController({
			rejectQuote: vi.fn().mockResolvedValue(quote),
		});
		const result = (await call(rejectHandler, {
			params: { id: quote.id },
			body: { reason: "Price too high" },
			controller: ctrl,
		})) as { quote: Quote };
		expect(result.quote.status).toBe("rejected");
		expect(ctrl.rejectQuote).toHaveBeenCalledWith(quote.id, "Price too high");
	});
});

// ── counterQuote ──────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/counter", () => {
	it("returns error when quote not found", async () => {
		const result = (await call(counterHandler, {
			params: { id: "missing" },
			body: { items: [] },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("counters quote with offered prices", async () => {
		const quote = makeQuote({ status: "countered" });
		const ctrl = makeController({
			counterQuote: vi.fn().mockResolvedValue(quote),
		});
		const result = (await call(counterHandler, {
			params: { id: quote.id },
			body: { items: [{ itemId: "item_1", offeredPrice: 4500 }] },
			controller: ctrl,
		})) as { quote: Quote };
		expect(result.quote.status).toBe("countered");
	});
});

// ── convertToOrder ────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/convert", () => {
	it("returns error when quote not found", async () => {
		const result = (await call(convertHandler, {
			params: { id: "missing" },
			body: { orderId: "order_1" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("converts quote to order", async () => {
		const quote = makeQuote({
			status: "accepted",
			convertedOrderId: "order_1",
		});
		const ctrl = makeController({
			convertToOrder: vi.fn().mockResolvedValue(quote),
		});
		const result = (await call(convertHandler, {
			params: { id: quote.id },
			body: { orderId: "order_1" },
			controller: ctrl,
		})) as { quote: Quote };
		expect(result.quote.convertedOrderId).toBe("order_1");
		expect(ctrl.convertToOrder).toHaveBeenCalledWith(quote.id, "order_1");
	});
});

// ── expireQuote ───────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/expire", () => {
	it("returns error when quote cannot expire", async () => {
		const result = (await call(expireHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Cannot expire this quote");
	});

	it("expires quote and returns it", async () => {
		const quote = makeQuote({ status: "expired" });
		const ctrl = makeController({
			expireQuote: vi.fn().mockResolvedValue(quote),
		});
		const result = (await call(expireHandler, {
			params: { id: quote.id },
			controller: ctrl,
		})) as { quote: Quote };
		expect(result.quote.status).toBe("expired");
	});
});

// ── addItem ───────────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/items", () => {
	it("returns error when quote is not in draft status", async () => {
		const ctrl = makeController({ addItem: vi.fn().mockResolvedValue(null) });
		const result = (await call(addItemHandler, {
			params: { id: "q1" },
			body: {
				productId: "p1",
				productName: "Widget",
				quantity: 1,
				unitPrice: 1000,
			},
			controller: ctrl,
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("adds item to quote and returns it", async () => {
		const item = makeItem({ productId: "p1" });
		const ctrl = makeController({ addItem: vi.fn().mockResolvedValue(item) });
		const result = (await call(addItemHandler, {
			params: { id: "q1" },
			body: {
				productId: "p1",
				productName: "Widget",
				quantity: 2,
				unitPrice: 5000,
			},
			controller: ctrl,
		})) as { item: QuoteItem };
		expect(result.item.productId).toBe("p1");
	});
});

// ── updateItem ────────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/items/:itemId", () => {
	it("returns error when item not found or quote not in draft", async () => {
		const result = (await call(updateItemHandler, {
			params: { id: "q1", itemId: "missing" },
			body: { quantity: 3 },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("updates item and returns it", async () => {
		const item = makeItem({ quantity: 3 });
		const ctrl = makeController({
			updateItem: vi.fn().mockResolvedValue(item),
		});
		const result = (await call(updateItemHandler, {
			params: { id: "q1", itemId: item.id },
			body: { quantity: 3 },
			controller: ctrl,
		})) as { item: QuoteItem };
		expect(result.item.quantity).toBe(3);
		expect(ctrl.updateItem).toHaveBeenCalledWith("q1", item.id, {
			quantity: 3,
		});
	});
});

// ── removeItem ────────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/items/:itemId/remove", () => {
	it("returns error when item not found", async () => {
		const result = (await call(removeItemHandler, {
			params: { id: "q1", itemId: "missing" },
		})) as { error: string };
		expect(result.error).toBeDefined();
	});

	it("removes item and returns success", async () => {
		const ctrl = makeController({
			removeItem: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(removeItemHandler, {
			params: { id: "q1", itemId: "item_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
		expect(ctrl.removeItem).toHaveBeenCalledWith("q1", "item_1");
	});
});

// ── addComment ────────────────────────────────────────────────────────────────

describe("admin POST /quotes/:id/comments/add", () => {
	it("adds comment and returns it", async () => {
		const comment = makeComment({ message: "Approved" });
		const ctrl = makeController({
			addComment: vi.fn().mockResolvedValue(comment),
		});
		const result = (await call(addCommentHandler, {
			params: { id: "q1" },
			body: { authorName: "Support", message: "Approved" },
			controller: ctrl,
		})) as { comment: QuoteComment };
		expect(result.comment.message).toBe("Approved");
		expect(ctrl.addComment).toHaveBeenCalledWith(
			expect.objectContaining({
				quoteId: "q1",
				authorType: "admin",
				message: "Approved",
			}),
		);
	});
});

// ── stats ─────────────────────────────────────────────────────────────────────

describe("admin GET /quotes/stats", () => {
	it("returns zero-state stats when no quotes", async () => {
		const result = (await call(statsHandler)) as { stats: QuoteStats };
		expect(result.stats.totalQuotes).toBe(0);
		expect(result.stats.conversionRate).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalQuotes: 50,
				draftQuotes: 5,
				submittedQuotes: 10,
				underReviewQuotes: 8,
				counteredQuotes: 7,
				acceptedQuotes: 12,
				rejectedQuotes: 4,
				expiredQuotes: 2,
				convertedQuotes: 10,
				totalValue: 500000,
				averageValue: 10000,
				conversionRate: 20,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: QuoteStats;
		};
		expect(result.stats.totalQuotes).toBe(50);
		expect(result.stats.conversionRate).toBe(20);
	});
});
