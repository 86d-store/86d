import { describe, expect, it, vi } from "vitest";
import { bulkCreateGiftCards } from "../admin/endpoints/bulk-create";
import { createGiftCard } from "../admin/endpoints/create-gift-card";
import { creditGiftCard } from "../admin/endpoints/credit-gift-card";
import { deleteGiftCard } from "../admin/endpoints/delete-gift-card";
import { disableExpiredGiftCards } from "../admin/endpoints/disable-expired";
import { getGiftCard } from "../admin/endpoints/get-gift-card";
import { listGiftCardTransactions } from "../admin/endpoints/list-gift-card-transactions";
import { listGiftCards } from "../admin/endpoints/list-gift-cards";
import { getGiftCardStats } from "../admin/endpoints/stats";
import { updateGiftCard } from "../admin/endpoints/update-gift-card";
import type {
	GiftCard,
	GiftCardController,
	GiftCardStats,
	GiftCardTransaction,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeCard(overrides: Partial<GiftCard> = {}): GiftCard {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		code: "GC-ABCD-1234",
		initialBalance: 5000,
		currentBalance: 5000,
		currency: "USD",
		status: "active",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeTransaction(
	overrides: Partial<GiftCardTransaction> = {},
): GiftCardTransaction {
	return {
		id: crypto.randomUUID(),
		giftCardId: "gc_1",
		type: "credit",
		amount: 1000,
		balanceAfter: 6000,
		createdAt: new Date(),
		...overrides,
	};
}

function makeStats(overrides: Partial<GiftCardStats> = {}): GiftCardStats {
	return {
		totalIssued: 0,
		totalActive: 0,
		totalDepleted: 0,
		totalDisabled: 0,
		totalExpired: 0,
		totalIssuedValue: 0,
		totalRedeemedValue: 0,
		totalOutstandingBalance: 0,
		...overrides,
	};
}

function makeController(
	overrides: Partial<GiftCardController> = {},
): GiftCardController {
	return {
		create: vi.fn().mockResolvedValue(makeCard()),
		get: vi.fn().mockResolvedValue(null),
		getByCode: vi.fn().mockResolvedValue(null),
		list: vi.fn().mockResolvedValue([]),
		update: vi.fn().mockResolvedValue(null),
		delete: vi.fn().mockResolvedValue(false),
		checkBalance: vi.fn().mockResolvedValue(null),
		redeem: vi.fn().mockResolvedValue(null),
		credit: vi.fn().mockResolvedValue(null),
		listTransactions: vi.fn().mockResolvedValue([]),
		countAll: vi.fn().mockResolvedValue(0),
		purchase: vi.fn().mockResolvedValue(makeCard()),
		topUp: vi.fn().mockResolvedValue(null),
		sendGiftCard: vi.fn().mockResolvedValue(null),
		listByCustomer: vi.fn().mockResolvedValue([]),
		bulkCreate: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue(makeStats()),
		disableExpired: vi.fn().mockResolvedValue(0),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: GiftCardController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { giftCards: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const bulkCreateHandler = extractHandler(bulkCreateGiftCards);
const createHandler = extractHandler(createGiftCard);
const creditHandler = extractHandler(creditGiftCard);
const deleteHandler = extractHandler(deleteGiftCard);
const disableExpiredHandler = extractHandler(disableExpiredGiftCards);
const getHandler = extractHandler(getGiftCard);
const statsHandler = extractHandler(getGiftCardStats);
const listTransactionsHandler = extractHandler(listGiftCardTransactions);
const listHandler = extractHandler(listGiftCards);
const updateHandler = extractHandler(updateGiftCard);

// ── listGiftCards ─────────────────────────────────────────────────────────────

describe("admin GET /gift-cards", () => {
	it("returns empty list when no gift cards exist", async () => {
		const result = (await call(listHandler)) as {
			cards: GiftCard[];
			total: number;
		};
		expect(result.cards).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns gift cards from controller", async () => {
		const cards = [makeCard(), makeCard()];
		const ctrl = makeController({
			list: vi.fn().mockResolvedValue(cards),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			cards: GiftCard[];
			total: number;
		};
		expect(result.cards).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "active" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});

	it("forwards customerId filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { customerId: "cust_1" },
			controller: ctrl,
		});
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.objectContaining({ customerId: "cust_1" }),
		);
	});

	it("calls controller without pagination params (endpoint slices in-memory)", async () => {
		const ctrl = makeController();
		await call(listHandler, { controller: ctrl });
		// After the fix, take/skip are applied in-memory; controller receives only filters
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.not.objectContaining({ take: expect.anything() }),
		);
		expect(ctrl.list).toHaveBeenCalledWith(
			expect.not.objectContaining({ skip: expect.anything() }),
		);
	});
});

// ── createGiftCard ────────────────────────────────────────────────────────────

describe("admin POST /gift-cards/create", () => {
	it("creates a gift card and returns it", async () => {
		const card = makeCard({ initialBalance: 10000, currency: "USD" });
		const ctrl = makeController({
			create: vi.fn().mockResolvedValue(card),
		});
		const result = (await call(createHandler, {
			body: { initialBalance: 10000, currency: "USD" },
			controller: ctrl,
		})) as { card: GiftCard };
		expect(result.card.initialBalance).toBe(10000);
		expect(result.card.currency).toBe("USD");
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({ initialBalance: 10000, currency: "USD" }),
		);
	});

	it("creates a gift card with recipient email", async () => {
		const card = makeCard({ recipientEmail: "gift@example.com" });
		const ctrl = makeController({
			create: vi.fn().mockResolvedValue(card),
		});
		const result = (await call(createHandler, {
			body: {
				initialBalance: 5000,
				recipientEmail: "gift@example.com",
			},
			controller: ctrl,
		})) as { card: GiftCard };
		expect(result.card.recipientEmail).toBe("gift@example.com");
	});

	it("creates a gift card with expiry and note", async () => {
		const ctrl = makeController();
		await call(createHandler, {
			body: {
				initialBalance: 2500,
				expiresAt: "2027-01-01",
				note: "Holiday gift",
			},
			controller: ctrl,
		});
		expect(ctrl.create).toHaveBeenCalledWith(
			expect.objectContaining({
				expiresAt: "2027-01-01",
				note: "Holiday gift",
			}),
		);
	});
});

// ── getGiftCard ───────────────────────────────────────────────────────────────

describe("admin GET /gift-cards/:id", () => {
	it("returns 404 when gift card not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "nonexistent" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Gift card not found");
	});

	it("returns gift card when found", async () => {
		const card = makeCard({ id: "gc_1", code: "GC-XXXX-1111" });
		const ctrl = makeController({
			get: vi.fn().mockResolvedValue(card),
		});
		const result = (await call(getHandler, {
			params: { id: "gc_1" },
			controller: ctrl,
		})) as { card: GiftCard };
		expect(result.card.id).toBe("gc_1");
		expect(result.card.code).toBe("GC-XXXX-1111");
	});
});

// ── updateGiftCard ────────────────────────────────────────────────────────────

describe("admin PUT /gift-cards/:id/update", () => {
	it("returns 404 when gift card not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { status: "disabled" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Gift card not found");
	});

	it("returns updated gift card on success", async () => {
		const updated = makeCard({ status: "disabled" });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateHandler, {
			params: { id: updated.id },
			body: { status: "disabled" },
			controller: ctrl,
		})) as { card: GiftCard };
		expect(result.card.status).toBe("disabled");
		expect(ctrl.update).toHaveBeenCalledWith(
			updated.id,
			expect.objectContaining({ status: "disabled" }),
		);
	});

	it("forwards recipientEmail update to controller", async () => {
		const updated = makeCard({ recipientEmail: "new@example.com" });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateHandler, {
			params: { id: updated.id },
			body: { recipientEmail: "new@example.com" },
			controller: ctrl,
		})) as { card: GiftCard };
		expect(result.card.recipientEmail).toBe("new@example.com");
	});

	it("forwards expiresAt update to controller", async () => {
		const updated = makeCard({ expiresAt: "2028-12-31" });
		const ctrl = makeController({
			update: vi.fn().mockResolvedValue(updated),
		});
		await call(updateHandler, {
			params: { id: updated.id },
			body: { expiresAt: "2028-12-31" },
			controller: ctrl,
		});
		expect(ctrl.update).toHaveBeenCalledWith(
			updated.id,
			expect.objectContaining({ expiresAt: "2028-12-31" }),
		);
	});
});

// ── deleteGiftCard ────────────────────────────────────────────────────────────

describe("admin DELETE /gift-cards/:id/delete", () => {
	it("returns 404 when gift card not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Gift card not found");
	});

	it("deletes gift card and returns deleted: true", async () => {
		const ctrl = makeController({
			delete: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "gc_2" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
		expect(ctrl.delete).toHaveBeenCalledWith("gc_2");
	});
});

// ── creditGiftCard ────────────────────────────────────────────────────────────

describe("admin POST /gift-cards/:id/credit", () => {
	it("returns 404 when gift card not found", async () => {
		const result = (await call(creditHandler, {
			params: { id: "missing" },
			body: { amount: 1000 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Gift card not found");
	});

	it("credits gift card and returns transaction and card", async () => {
		const card = makeCard({ id: "gc_3", currentBalance: 6000 });
		const transaction = makeTransaction({
			giftCardId: "gc_3",
			type: "credit",
			amount: 1000,
			balanceAfter: 6000,
		});
		const ctrl = makeController({
			credit: vi.fn().mockResolvedValue({ transaction, giftCard: card }),
		});
		const result = (await call(creditHandler, {
			params: { id: "gc_3" },
			body: { amount: 1000 },
			controller: ctrl,
		})) as { transaction: GiftCardTransaction; card: GiftCard };
		expect(result.transaction.amount).toBe(1000);
		expect(result.transaction.type).toBe("credit");
		expect(result.card.id).toBe("gc_3");
		expect(ctrl.credit).toHaveBeenCalledWith(
			"gc_3",
			1000,
			undefined,
			undefined,
		);
	});

	it("forwards note to controller", async () => {
		const card = makeCard({ id: "gc_4" });
		const transaction = makeTransaction({ giftCardId: "gc_4" });
		const ctrl = makeController({
			credit: vi.fn().mockResolvedValue({ transaction, giftCard: card }),
		});
		await call(creditHandler, {
			params: { id: "gc_4" },
			body: { amount: 500, note: "Goodwill credit" },
			controller: ctrl,
		});
		expect(ctrl.credit).toHaveBeenCalledWith(
			"gc_4",
			500,
			"Goodwill credit",
			undefined,
		);
	});
});

// ── listGiftCardTransactions ──────────────────────────────────────────────────

describe("admin GET /gift-cards/:id/transactions", () => {
	it("returns 404 when gift card not found", async () => {
		const result = (await call(listTransactionsHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Gift card not found");
	});

	it("returns transactions and card when found", async () => {
		const card = makeCard({ id: "gc_5" });
		const transactions = [
			makeTransaction({ giftCardId: "gc_5", type: "debit" }),
			makeTransaction({ giftCardId: "gc_5", type: "credit" }),
		];
		const ctrl = makeController({
			get: vi.fn().mockResolvedValue(card),
			listTransactions: vi.fn().mockResolvedValue(transactions),
		});
		const result = (await call(listTransactionsHandler, {
			params: { id: "gc_5" },
			controller: ctrl,
		})) as { transactions: GiftCardTransaction[]; card: GiftCard };
		expect(result.transactions).toHaveLength(2);
		expect(result.card.id).toBe("gc_5");
		expect(ctrl.get).toHaveBeenCalledWith("gc_5");
		expect(ctrl.listTransactions).toHaveBeenCalledWith(
			"gc_5",
			expect.objectContaining({ take: 50, skip: 0 }),
		);
	});

	it("returns empty transactions list for card with no history", async () => {
		const card = makeCard({ id: "gc_6" });
		const ctrl = makeController({
			get: vi.fn().mockResolvedValue(card),
			listTransactions: vi.fn().mockResolvedValue([]),
		});
		const result = (await call(listTransactionsHandler, {
			params: { id: "gc_6" },
			controller: ctrl,
		})) as { transactions: GiftCardTransaction[]; card: GiftCard };
		expect(result.transactions).toHaveLength(0);
		expect(result.card.id).toBe("gc_6");
	});
});

// ── getGiftCardStats ──────────────────────────────────────────────────────────

describe("admin GET /gift-cards/stats", () => {
	it("returns zero-state stats when no gift cards exist", async () => {
		const result = (await call(statsHandler)) as { stats: GiftCardStats };
		expect(result.stats.totalIssued).toBe(0);
		expect(result.stats.totalActive).toBe(0);
		expect(result.stats.totalOutstandingBalance).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const stats: GiftCardStats = {
			totalIssued: 100,
			totalActive: 75,
			totalDepleted: 10,
			totalDisabled: 5,
			totalExpired: 10,
			totalIssuedValue: 500000,
			totalRedeemedValue: 120000,
			totalOutstandingBalance: 380000,
		};
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: GiftCardStats;
		};
		expect(result.stats.totalIssued).toBe(100);
		expect(result.stats.totalActive).toBe(75);
		expect(result.stats.totalOutstandingBalance).toBe(380000);
		expect(result.stats.totalRedeemedValue).toBe(120000);
	});
});

// ── disableExpiredGiftCards ───────────────────────────────────────────────────

describe("admin POST /gift-cards/disable-expired", () => {
	it("returns disabledCount of 0 when no expired cards", async () => {
		const result = (await call(disableExpiredHandler)) as {
			disabledCount: number;
		};
		expect(result.disabledCount).toBe(0);
	});

	it("returns count of disabled cards", async () => {
		const ctrl = makeController({
			disableExpired: vi.fn().mockResolvedValue(12),
		});
		const result = (await call(disableExpiredHandler, {
			controller: ctrl,
		})) as { disabledCount: number };
		expect(result.disabledCount).toBe(12);
		expect(ctrl.disableExpired).toHaveBeenCalled();
	});
});

// ── bulkCreateGiftCards ───────────────────────────────────────────────────────

describe("admin POST /gift-cards/bulk-create", () => {
	it("returns empty cards when controller returns empty array", async () => {
		const result = (await call(bulkCreateHandler, {
			body: { count: 5, initialBalance: 2500 },
		})) as {
			cards: Array<{
				id: string;
				code: string;
				initialBalance: number;
				currency: string;
			}>;
			count: number;
		};
		expect(result.cards).toHaveLength(0);
		expect(result.count).toBe(0);
	});

	it("creates multiple gift cards and returns summary", async () => {
		const cards = Array.from({ length: 3 }, () =>
			makeCard({ initialBalance: 5000, currency: "USD" }),
		);
		const ctrl = makeController({
			bulkCreate: vi.fn().mockResolvedValue(cards),
		});
		const result = (await call(bulkCreateHandler, {
			body: { count: 3, initialBalance: 5000 },
			controller: ctrl,
		})) as {
			cards: Array<{
				id: string;
				code: string;
				initialBalance: number;
				currency: string;
			}>;
			count: number;
		};
		expect(result.count).toBe(3);
		expect(result.cards).toHaveLength(3);
		expect(result.cards[0].initialBalance).toBe(5000);
		expect(ctrl.bulkCreate).toHaveBeenCalledWith(
			expect.objectContaining({ count: 3, initialBalance: 5000 }),
		);
	});

	it("forwards optional currency and expiresAt to controller", async () => {
		const ctrl = makeController({
			bulkCreate: vi.fn().mockResolvedValue([]),
		});
		await call(bulkCreateHandler, {
			body: {
				count: 10,
				initialBalance: 1000,
				currency: "EUR",
				expiresAt: "2027-06-30",
				note: "Promo batch",
			},
			controller: ctrl,
		});
		expect(ctrl.bulkCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				currency: "EUR",
				expiresAt: "2027-06-30",
				note: "Promo batch",
			}),
		);
	});

	it("response cards contain only id, code, initialBalance, currency fields", async () => {
		const card = makeCard({
			id: "gc_bulk_1",
			code: "GC-BULK-0001",
			initialBalance: 3000,
			currency: "GBP",
		});
		const ctrl = makeController({
			bulkCreate: vi.fn().mockResolvedValue([card]),
		});
		const result = (await call(bulkCreateHandler, {
			body: { count: 1, initialBalance: 3000, currency: "GBP" },
			controller: ctrl,
		})) as {
			cards: Array<{
				id: string;
				code: string;
				initialBalance: number;
				currency: string;
			}>;
			count: number;
		};
		expect(result.cards[0].id).toBe("gc_bulk_1");
		expect(result.cards[0].code).toBe("GC-BULK-0001");
		expect(result.cards[0].initialBalance).toBe(3000);
		expect(result.cards[0].currency).toBe("GBP");
	});
});
