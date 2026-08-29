import { describe, expect, it, vi } from "vitest";
import type { GiftCard, GiftCardController } from "../service";
import { GiftCardDataUnavailableError } from "../service-impl";
import { checkGiftCardBalance } from "../store/endpoints/check-balance";
import { listMyGiftCards } from "../store/endpoints/my-cards";
import { sendGiftCard } from "../store/endpoints/send";

function extractHandler(
	endpoint: unknown,
): (context: Record<string, unknown>) => Promise<unknown> {
	const candidate = endpoint as Record<string, unknown>;
	const handler =
		typeof candidate.handler === "function" ? candidate.handler : endpoint;
	return handler as (context: Record<string, unknown>) => Promise<unknown>;
}

function card(overrides: Partial<GiftCard> = {}): GiftCard {
	const now = new Date("2026-01-01T00:00:00.000Z");
	return {
		id: "card_1",
		code: "GIFT-ABCD-EFGH-JKNP",
		initialBalance: 5_000,
		currentBalance: 4_000,
		currency: "USD",
		status: "active",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function controller(
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
		getStats: vi.fn().mockResolvedValue({
			totalIssued: 0,
			totalActive: 0,
			totalDepleted: 0,
			totalDisabled: 0,
			totalExpired: 0,
			totalIssuedValue: 0,
			totalRedeemedValue: 0,
			totalOutstandingBalance: 0,
		}),
		...overrides,
	};
}

function context(
	giftCards: GiftCardController,
	options: {
		query?: Record<string, unknown>;
		body?: Record<string, unknown>;
		userId?: string;
	} = {},
) {
	return {
		query: options.query ?? {},
		body: options.body ?? {},
		params: {},
		context: {
			controllers: { giftCards },
			...(options.userId ? { session: { user: { id: options.userId } } } : {}),
		},
	};
}

const checkHandler = extractHandler(checkGiftCardBalance);
const sendHandler = extractHandler(sendGiftCard);
const myCardsHandler = extractHandler(listMyGiftCards);

describe("gift-card retained Store handler contract", () => {
	it("maps malformed durable data to stable unavailable responses", async () => {
		const unavailable = new GiftCardDataUnavailableError();

		await expect(
			checkHandler(
				context(
					controller({
						checkBalance: vi.fn().mockRejectedValue(unavailable),
					}),
					{ query: { code: "GIFT-CODE" } },
				),
			),
		).resolves.toEqual({
			error: "Gift card balance is unavailable",
			status: 503,
		});
		await expect(
			myCardsHandler(
				context(
					controller({
						listByCustomer: vi.fn().mockRejectedValue(unavailable),
					}),
					{ userId: "customer_1" },
				),
			),
		).resolves.toEqual({ error: "Gift cards are unavailable", status: 503 });
		await expect(
			sendHandler(
				context(
					controller({
						sendGiftCard: vi.fn().mockRejectedValue(unavailable),
					}),
					{
						userId: "customer_1",
						body: {
							giftCardId: "card_1",
							recipientEmail: "recipient@example.com",
						},
					},
				),
			),
		).resolves.toEqual({
			error: "Gift card delivery metadata is unavailable",
			status: 503,
		});
	});

	it("does not mask unexpected controller failures", async () => {
		await expect(
			checkHandler(
				context(
					controller({
						checkBalance: vi
							.fn()
							.mockRejectedValue(new Error("database offline")),
					}),
					{ query: { code: "GIFT-CODE" } },
				),
			),
		).rejects.toThrow("database offline");
	});

	it("returns the balance projection produced by the controller", async () => {
		const giftCards = controller({
			checkBalance: vi.fn().mockResolvedValue({
				balance: 4_000,
				currency: "USD",
				status: "active",
			}),
		});

		await expect(
			checkHandler(context(giftCards, { query: { code: "GIFT-CODE" } })),
		).resolves.toEqual({ balance: 4_000, currency: "USD", status: "active" });
		expect(giftCards.checkBalance).toHaveBeenCalledWith("GIFT-CODE");
	});

	it("requires authentication before recording delivery metadata", async () => {
		const giftCards = controller();

		await expect(
			sendHandler(
				context(giftCards, {
					body: {
						giftCardId: "card_1",
						recipientEmail: "recipient@example.com",
					},
				}),
			),
		).resolves.toEqual({ error: "Authentication required", status: 401 });
		expect(giftCards.sendGiftCard).not.toHaveBeenCalled();
	});

	it("derives the delivery owner from the authenticated session", async () => {
		const stored = card({ recipientEmail: "recipient@example.com" });
		const giftCards = controller({
			sendGiftCard: vi.fn().mockResolvedValue(stored),
		});

		await expect(
			sendHandler(
				context(giftCards, {
					userId: "customer_1",
					body: {
						giftCardId: stored.id,
						recipientEmail: "recipient@example.com",
					},
				}),
			),
		).resolves.toEqual({
			id: stored.id,
			recipientEmail: "recipient@example.com",
			deliveryMetadataRecorded: true,
			delivered: false,
		});
		expect(giftCards.sendGiftCard).toHaveBeenCalledWith({
			giftCardId: stored.id,
			customerId: "customer_1",
			recipientEmail: "recipient@example.com",
			recipientName: undefined,
			senderName: undefined,
			message: undefined,
		});
	});

	it("requires authentication and session-scopes owned-card listing", async () => {
		const giftCards = controller({
			listByCustomer: vi.fn().mockResolvedValue([card()]),
		});

		await expect(myCardsHandler(context(giftCards))).resolves.toEqual({
			error: "Authentication required",
			status: 401,
		});
		await myCardsHandler(
			context(giftCards, {
				userId: "customer_2",
				query: { take: 25, skip: 5 },
			}),
		);
		expect(giftCards.listByCustomer).toHaveBeenCalledWith("customer_2", {
			take: 25,
			skip: 5,
		});
	});
});
