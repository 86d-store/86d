import {
	createMockDataService,
	createMockTransactionRunner,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import giftCards from "../index";
import type { GiftCard } from "../service";
import { createGiftCardController } from "../service-impl";
import { storeEndpoints } from "../store/endpoints/routes";

/**
 * Store endpoint integration tests for the giftcards module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. Balance check returns correct data and handles missing/expired cards
 * 2. Direct purchase, top-up, and redemption remain unexposed
 * 3. Send verifies card ownership before allowing transfer
 * 4. My-cards scopes results to the authenticated customer
 * 5. Response shaping matches what the client expects
 */

type DataService = ReturnType<typeof createMockDataService>;

describe("store surface exposure", () => {
	it("does not expose direct gift card money routes", () => {
		expect(storeEndpoints).toHaveProperty("/gift-cards/check");
		for (const route of [
			"/gift-cards/purchase",
			"/gift-cards/top-up",
			"/gift-cards/redeem",
		]) {
			expect(storeEndpoints).not.toHaveProperty(route);
		}
	});

	it("registers only balance-focused store pages", () => {
		expect(giftCards().store?.pages).toEqual([
			{ path: "/gift-cards", component: "GiftCardLanding" },
			{ path: "/gift-cards/balance", component: "GiftCardBalance" },
		]);
	});
});

// ── Simulate store endpoint logic ────────────────────────────────────

/**
 * Simulate check-balance endpoint: public, no auth required.
 * Returns balance, currency, status or 404.
 */
async function simulateCheckBalance(data: DataService, code: string) {
	const controller = createGiftCardController(data);
	const result = await controller.checkBalance(code);

	if (!result) {
		return { error: "Gift card not found", status: 404 };
	}

	return {
		balance: result.balance,
		currency: result.currency,
		status: result.status,
	};
}

/**
 * Simulate send endpoint: requires session, verifies ownership.
 */
async function simulateSend(
	data: DataService,
	body: {
		giftCardId: string;
		recipientEmail: string;
		recipientName?: string;
		senderName?: string;
		message?: string;
	},
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createGiftCardController(
		data,
		createMockTransactionRunner({ data }),
	);
	const result = await controller.sendGiftCard({
		giftCardId: body.giftCardId,
		customerId: session.userId,
		recipientEmail: body.recipientEmail,
		recipientName: body.recipientName,
		senderName: body.senderName,
		message: body.message,
	});

	if (!result) {
		return {
			error: "Gift card delivery metadata could not be recorded",
			status: 400,
		};
	}

	return {
		id: result.id,
		recipientEmail: result.recipientEmail,
		deliveryMetadataRecorded: true,
		delivered: result.delivered === true,
	};
}

/**
 * Simulate my-cards endpoint: requires session, scoped to user.
 */
async function simulateMyCards(
	data: DataService,
	query: { take?: number; skip?: number },
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createGiftCardController(data);
	const cards = await controller.listByCustomer(session.userId, {
		take: query.take ?? 50,
		skip: query.skip ?? 0,
	});

	return {
		cards: cards.map((card) => ({
			id: card.id,
			code: card.code,
			currentBalance: card.currentBalance,
			initialBalance: card.initialBalance,
			currency: card.currency,
			status: card.status,
			expiresAt: card.expiresAt,
			recipientEmail: card.recipientEmail,
			recipientName: card.recipientName,
			senderName: card.senderName,
			message: card.message,
			createdAt: card.createdAt,
		})),
		total: cards.length,
	};
}

// ── Helper ───────────────────────────────────────────────────────────

async function seedGiftCard(
	data: DataService,
	overrides: Partial<GiftCard> = {},
) {
	const now = new Date("2026-01-01T00:00:00.000Z");
	const initialBalance = overrides.initialBalance ?? 5_000;
	const card: GiftCard = {
		id: overrides.id ?? crypto.randomUUID(),
		code:
			overrides.code ??
			`GIFT-${crypto.randomUUID().slice(0, 14).toUpperCase()}`,
		initialBalance,
		currentBalance: overrides.currentBalance ?? initialBalance,
		currency: "USD",
		status: "active",
		delivered: false,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
	await data.upsert("giftCard", card.id, { ...card });
	return card;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("store endpoint: check balance", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns balance for a valid active card", async () => {
		const card = await seedGiftCard(data, {
			initialBalance: 5000,
			currency: "USD",
		});

		const result = await simulateCheckBalance(data, card.code);
		expect(result).toEqual({
			balance: 5000,
			currency: "USD",
			status: "active",
		});
	});

	it("returns 404 for a nonexistent code", async () => {
		const result = await simulateCheckBalance(data, "FAKE-CODE-1234-5678");
		expect(result).toEqual({ error: "Gift card not found", status: 404 });
	});

	it("returns zero balance and expired status for expired card", async () => {
		const card = await seedGiftCard(data, {
			initialBalance: 5000,
			expiresAt: "2020-01-01T00:00:00.000Z",
		});

		const result = await simulateCheckBalance(data, card.code);
		expect(result).toEqual({
			balance: 0,
			currency: "USD",
			status: "expired",
		});
	});

	it("returns balance for a depleted card", async () => {
		const card = await seedGiftCard(data, {
			initialBalance: 5000,
			currentBalance: 0,
			status: "depleted",
		});

		const result = await simulateCheckBalance(data, card.code);
		expect(result).toEqual({
			balance: 0,
			currency: "USD",
			status: "depleted",
		});
	});

	it("is case-insensitive for code lookup", async () => {
		const card = await seedGiftCard(data, { initialBalance: 3000 });

		const result = await simulateCheckBalance(data, card.code.toLowerCase());
		expect(result).toEqual({
			balance: 3000,
			currency: "USD",
			status: "active",
		});
	});
});

describe("store endpoint: send — ownership verification", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 when no session is provided", async () => {
		const result = await simulateSend(
			data,
			{ giftCardId: "any", recipientEmail: "friend@example.com" },
			null,
		);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("lets the card owner record delivery intent without claiming delivery", async () => {
		const card = await seedGiftCard(data, { customerId: "cust_1" });

		const result = await simulateSend(
			data,
			{
				giftCardId: card.id,
				recipientEmail: "friend@example.com",
				recipientName: "Friend",
				senderName: "Me",
				message: "Enjoy!",
			},
			{ userId: "cust_1" },
		);

		expect("delivered" in result).toBe(true);
		if (!("delivered" in result)) {
			throw new Error("expected 'delivered' in result");
		}
		expect(result.delivered).toBe(false);
		expect(result.deliveryMetadataRecorded).toBe(true);
		expect(result.recipientEmail).toBe("friend@example.com");
		const recorded = await data.get("giftCard", card.id);
		expect(recorded).toMatchObject({
			recipientEmail: "friend@example.com",
			deliveryMethod: "email",
			delivered: false,
		});
		expect(recorded).not.toHaveProperty("deliveredAt");
	});

	it("allows the purchaser to send a card they bought for someone", async () => {
		const card = await seedGiftCard(data, {
			purchasedByCustomerId: "cust_buyer",
		});

		const result = await simulateSend(
			data,
			{
				giftCardId: card.id,
				recipientEmail: "recipient@example.com",
			},
			{ userId: "cust_buyer" },
		);

		expect("delivered" in result).toBe(true);
		if (!("delivered" in result)) {
			throw new Error("expected 'delivered' in result");
		}
		expect(result.delivered).toBe(false);
		expect(result.deliveryMetadataRecorded).toBe(true);
	});

	it("returns 400 when a non-owner tries to send someone else's card", async () => {
		const card = await seedGiftCard(data, { customerId: "cust_1" });

		const result = await simulateSend(
			data,
			{
				giftCardId: card.id,
				recipientEmail: "thief@example.com",
			},
			{ userId: "cust_attacker" },
		);

		expect(result).toEqual({
			error: "Gift card delivery metadata could not be recorded",
			status: 400,
		});
	});

	it("returns 400 when card is already delivered", async () => {
		const card = await seedGiftCard(data, {
			customerId: "cust_1",
			delivered: true,
			recipientEmail: "first@example.com",
		});

		const result = await simulateSend(
			data,
			{
				giftCardId: card.id,
				recipientEmail: "second@example.com",
			},
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Gift card delivery metadata could not be recorded",
			status: 400,
		});
	});

	it("returns 400 for a disabled card", async () => {
		const card = await seedGiftCard(data, {
			customerId: "cust_1",
			status: "disabled",
		});

		const result = await simulateSend(
			data,
			{
				giftCardId: card.id,
				recipientEmail: "friend@example.com",
			},
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Gift card delivery metadata could not be recorded",
			status: 400,
		});
	});

	it("returns 400 for a nonexistent card ID", async () => {
		const result = await simulateSend(
			data,
			{
				giftCardId: "nonexistent",
				recipientEmail: "friend@example.com",
			},
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Gift card delivery metadata could not be recorded",
			status: 400,
		});
	});
});

describe("store endpoint: my-cards — customer scoping", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 when no session is provided", async () => {
		const result = await simulateMyCards(data, {}, null);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("returns only cards owned by the authenticated customer", async () => {
		await seedGiftCard(data, { customerId: "cust_1", initialBalance: 3000 });
		await seedGiftCard(data, { customerId: "cust_1", initialBalance: 5000 });
		await seedGiftCard(data, { customerId: "cust_2", initialBalance: 1000 });

		const result = await simulateMyCards(data, {}, { userId: "cust_1" });

		expect("cards" in result).toBe(true);
		if (!("cards" in result)) {
			throw new Error("expected 'cards' in result");
		}
		expect(result.cards).toHaveLength(2);
		expect(result.total).toBe(2);
		expect(
			result.cards.every(
				(c) => c.currentBalance === 3000 || c.currentBalance === 5000,
			),
		).toBe(true);
	});

	it("returns empty list for a customer with no cards", async () => {
		await seedGiftCard(data, { customerId: "cust_other" });

		const result = await simulateMyCards(data, {}, { userId: "cust_1" });

		expect("cards" in result).toBe(true);
		if (!("cards" in result)) {
			throw new Error("expected 'cards' in result");
		}
		expect(result.cards).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("shapes response with the correct fields", async () => {
		await seedGiftCard(data, {
			customerId: "cust_1",
			initialBalance: 5000,
			recipientEmail: "friend@example.com",
		});

		const result = await simulateMyCards(data, {}, { userId: "cust_1" });

		expect("cards" in result).toBe(true);
		if (!("cards" in result)) {
			throw new Error("expected 'cards' in result");
		}
		const card = result.cards[0];
		expect(card).toHaveProperty("id");
		expect(card).toHaveProperty("code");
		expect(card).toHaveProperty("currentBalance");
		expect(card).toHaveProperty("initialBalance");
		expect(card).toHaveProperty("currency");
		expect(card).toHaveProperty("status");
		expect(card).toHaveProperty("createdAt");
		expect(card.currentBalance).toBe(5000);
		expect(card.initialBalance).toBe(5000);
		expect(card.currency).toBe("USD");
		expect(card.status).toBe("active");
	});

	it("does not expose cards from other customers", async () => {
		const otherCard = await seedGiftCard(data, {
			customerId: "cust_2",
			initialBalance: 10000,
		});

		const result = await simulateMyCards(data, {}, { userId: "cust_1" });

		expect("cards" in result).toBe(true);
		if (!("cards" in result)) {
			throw new Error("expected 'cards' in result");
		}
		expect(result.cards.some((c) => c.id === otherCard.id)).toBe(false);
	});
});
