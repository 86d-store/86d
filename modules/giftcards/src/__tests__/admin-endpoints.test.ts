import { describe, expect, it, vi } from "vitest";
import { getGiftCard } from "../admin/endpoints/get-gift-card";
import { listGiftCardTransactions } from "../admin/endpoints/list-gift-card-transactions";
import { listGiftCards } from "../admin/endpoints/list-gift-cards";
import { getGiftCardStats } from "../admin/endpoints/stats";
import type {
	GiftCard,
	GiftCardController,
	GiftCardStats,
	GiftCardTransaction,
} from "../service";
import { GiftCardDataUnavailableError } from "../service-impl";

function extractHandler(
	endpoint: unknown,
): (context: Record<string, unknown>) => Promise<unknown> {
	const candidate = endpoint as Record<string, unknown>;
	const handler =
		typeof candidate.handler === "function" ? candidate.handler : endpoint;
	return handler as (context: Record<string, unknown>) => Promise<unknown>;
}

function makeCard(overrides: Partial<GiftCard> = {}): GiftCard {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		code: "GIFT-ABCD-EFGH-JKMP",
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
		get: vi.fn().mockResolvedValue(null),
		getByCode: vi.fn().mockResolvedValue(null),
		list: vi.fn().mockResolvedValue([]),
		listAdminPage: vi.fn().mockResolvedValue({ cards: [], total: 0 }),
		checkBalance: vi.fn().mockResolvedValue(null),
		listTransactions: vi.fn().mockResolvedValue([]),
		countAll: vi.fn().mockResolvedValue(0),
		sendGiftCard: vi.fn().mockResolvedValue(null),
		listByCustomer: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue(makeStats()),
		...overrides,
	};
}

function call(
	handler: (context: Record<string, unknown>) => Promise<unknown>,
	options: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		controller?: GiftCardController;
	} = {},
) {
	return handler({
		query: options.query ?? {},
		params: options.params ?? {},
		body: {},
		context: {
			controllers: { giftCards: options.controller ?? makeController() },
		},
	});
}

const getHandler = extractHandler(getGiftCard);
const listHandler = extractHandler(listGiftCards);
const statsHandler = extractHandler(getGiftCardStats);
const listTransactionsHandler = extractHandler(listGiftCardTransactions);

describe("admin gift-card unavailable containment", () => {
	it("maps malformed durable data to stable 503 responses", async () => {
		const unavailable = new GiftCardDataUnavailableError();
		const card = makeCard({ id: "gc_unavailable" });

		await expect(
			call(listHandler, {
				controller: makeController({
					listAdminPage: vi.fn().mockRejectedValue(unavailable),
				}),
			}),
		).resolves.toEqual({ error: "Gift cards are unavailable", status: 503 });
		await expect(
			call(getHandler, {
				params: { id: card.id },
				controller: makeController({
					get: vi.fn().mockRejectedValue(unavailable),
				}),
			}),
		).resolves.toEqual({
			error: "Gift card details are unavailable",
			status: 503,
		});
		await expect(
			call(listTransactionsHandler, {
				params: { id: card.id },
				controller: makeController({
					get: vi.fn().mockResolvedValue(card),
					listTransactions: vi.fn().mockRejectedValue(unavailable),
				}),
			}),
		).resolves.toEqual({
			error: "Gift card details are unavailable",
			status: 503,
		});
		await expect(
			call(statsHandler, {
				controller: makeController({
					getStats: vi.fn().mockRejectedValue(unavailable),
				}),
			}),
		).resolves.toEqual({
			error: "Gift card summaries are unavailable",
			status: 503,
		});
	});

	it("does not mask unexpected controller failures", async () => {
		await expect(
			call(listHandler, {
				controller: makeController({
					listAdminPage: vi
						.fn()
						.mockRejectedValue(new Error("database offline")),
				}),
			}),
		).rejects.toThrow("database offline");
	});
});

describe("admin GET /gift-cards", () => {
	it("returns an empty page", async () => {
		const result = (await call(listHandler)) as {
			cards: GiftCard[];
			total: number;
		};

		expect(result).toEqual({ cards: [], total: 0 });
	});

	it("delegates filtering, ordering, and pagination as one read projection", async () => {
		const cards = [
			makeCard({ id: "gc_1" }),
			makeCard({ id: "gc_2" }),
			makeCard({ id: "gc_3" }),
		];
		const controller = makeController({
			listAdminPage: vi.fn().mockResolvedValue({
				cards: [cards[1]],
				total: 3,
			}),
		});

		const result = (await call(listHandler, {
			query: {
				status: "active",
				customerId: "customer_1",
				search: "recipient@example.com",
				sort: "balance",
				direction: "asc",
				take: "1",
				skip: "1",
			},
			controller,
		})) as { cards: GiftCard[]; total: number };

		expect(result.cards.map((card) => card.id)).toEqual(["gc_2"]);
		expect(result.total).toBe(3);
		expect(controller.listAdminPage).toHaveBeenCalledWith({
			status: "active",
			customerId: "customer_1",
			search: "recipient@example.com",
			sort: "balance",
			direction: "asc",
			take: 1,
			skip: 1,
		});
	});
});

describe("admin GET /gift-cards/:id", () => {
	it("returns 404 when the card is absent", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };

		expect(result).toEqual({ error: "Gift card not found", status: 404 });
	});

	it("returns the requested card", async () => {
		const card = makeCard({ id: "gc_1" });
		const controller = makeController({
			get: vi.fn().mockResolvedValue(card),
		});

		const result = (await call(getHandler, {
			params: { id: card.id },
			controller,
		})) as { card: GiftCard };

		expect(result.card).toEqual(card);
		expect(controller.get).toHaveBeenCalledWith(card.id);
	});
});

describe("admin GET /gift-cards/:id/transactions", () => {
	it("returns 404 without reading transactions when the card is absent", async () => {
		const controller = makeController();

		const result = (await call(listTransactionsHandler, {
			params: { id: "missing" },
			controller,
		})) as { error: string; status: number };

		expect(result).toEqual({ error: "Gift card not found", status: 404 });
		expect(controller.listTransactions).not.toHaveBeenCalled();
	});

	it("returns the card and its paginated transaction history", async () => {
		const card = makeCard({ id: "gc_2" });
		const transactions = [
			makeTransaction({ giftCardId: card.id, type: "purchase" }),
			makeTransaction({ giftCardId: card.id, type: "debit" }),
		];
		const controller = makeController({
			get: vi.fn().mockResolvedValue(card),
			listTransactions: vi.fn().mockResolvedValue(transactions),
		});

		const result = (await call(listTransactionsHandler, {
			params: { id: card.id },
			query: { take: "25", skip: "10" },
			controller,
		})) as { card: GiftCard; transactions: GiftCardTransaction[] };

		expect(result).toEqual({ card, transactions });
		expect(controller.listTransactions).toHaveBeenCalledWith(card.id, {
			take: 25,
			skip: 10,
		});
	});
});

describe("admin GET /gift-cards/stats", () => {
	it("returns the controller's read-only summary", async () => {
		const stats = makeStats({
			totalIssued: 100,
			totalActive: 75,
			totalDepleted: 10,
			totalDisabled: 5,
			totalExpired: 10,
			totalIssuedValue: 500000,
			totalRedeemedValue: 120000,
			totalOutstandingBalance: 380000,
		});
		const controller = makeController({
			getStats: vi.fn().mockResolvedValue(stats),
		});

		const result = (await call(statsHandler, { controller })) as {
			stats: GiftCardStats;
		};

		expect(result.stats).toEqual(stats);
		expect(controller.getStats).toHaveBeenCalledOnce();
	});
});
