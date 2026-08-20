import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGiftCardController } from "../service-impl";

/**
 * Store endpoint integration tests for the giftcards module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. Balance check returns correct data and handles missing/expired cards
 * 2. Redeem requires authentication and enforces balance constraints
 * 3. Purchase derives customerId from session, not request body
 * 4. Send verifies card ownership before allowing transfer
 * 5. Top-up enforces ownership — only the card's customer can top up
 * 6. My-cards scopes results to the authenticated customer
 * 7. Response shaping matches what the client expects
 */

type DataService = ReturnType<typeof createMockDataService>;

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
 * Simulate redeem endpoint: requires session.
 * Returns amountApplied, remainingBalance, currency or errors.
 */
async function simulateRedeem(
	data: DataService,
	body: { code: string; amount: number; orderId?: string },
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createGiftCardController(data);
	const result = await controller.redeem(body.code, body.amount, body.orderId);

	if (!result) {
		return {
			error: "Gift card not found, inactive, expired, or insufficient balance",
			status: 400,
		};
	}

	return {
		amountApplied: result.transaction.amount,
		remainingBalance: result.giftCard.currentBalance,
		currency: result.giftCard.currency,
	};
}

/**
 * Simulate purchase endpoint: requires session.
 * customerId and customerEmail are derived from session, not body.
 */
async function simulatePurchase(
	data: DataService,
	body: {
		amount: number;
		currency?: string;
		recipientEmail?: string;
		recipientName?: string;
		senderName?: string;
		message?: string;
	},
	session: { userId: string; email: string } | null,
) {
	if (!session) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createGiftCardController(data);
	const card = await controller.purchase({
		amount: body.amount,
		currency: body.currency,
		customerId: session.userId,
		customerEmail: session.email,
		recipientEmail: body.recipientEmail,
		recipientName: body.recipientName,
		senderName: body.senderName,
		message: body.message,
	});

	return {
		id: card.id,
		code: card.code,
		balance: card.currentBalance,
		currency: card.currency,
		recipientEmail: card.recipientEmail,
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

	const controller = createGiftCardController(data);
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
			error: "Gift card not found, not owned by you, or already sent",
			status: 400,
		};
	}

	return {
		id: result.id,
		recipientEmail: result.recipientEmail,
		delivered: result.delivered,
	};
}

/**
 * Simulate top-up endpoint: requires session, verifies ownership.
 */
async function simulateTopUp(
	data: DataService,
	body: { giftCardId: string; amount: number },
	session: { userId: string } | null,
) {
	if (!session) {
		return { error: "Authentication required", status: 401 };
	}

	const controller = createGiftCardController(data);
	const result = await controller.topUp({
		giftCardId: body.giftCardId,
		customerId: session.userId,
		amount: body.amount,
	});

	if (!result) {
		return {
			error:
				"Gift card not found, not owned by you, disabled, or invalid amount",
			status: 400,
		};
	}

	return {
		newBalance: result.giftCard.currentBalance,
		currency: result.giftCard.currency,
		amountAdded: result.transaction.amount,
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
	overrides: Partial<{
		id: string;
		code: string;
		initialBalance: number;
		currentBalance: number;
		currency: string;
		status: string;
		customerId: string;
		purchasedByCustomerId: string;
		expiresAt: string;
		delivered: boolean;
		recipientEmail: string;
	}> = {},
) {
	const controller = createGiftCardController(data);
	const card = await controller.create({
		initialBalance: overrides.initialBalance ?? 5000,
		currency: overrides.currency ?? "USD",
		customerId: overrides.customerId,
		purchasedByCustomerId: overrides.purchasedByCustomerId,
		expiresAt: overrides.expiresAt,
		recipientEmail: overrides.recipientEmail,
	});

	// Apply any status/balance overrides directly
	if (
		overrides.status ||
		overrides.currentBalance !== undefined ||
		overrides.delivered !== undefined
	) {
		const raw = (await data.get("giftCard", card.id)) as Record<
			string,
			unknown
		>;
		if (raw) {
			if (overrides.status) raw.status = overrides.status;
			if (overrides.currentBalance !== undefined)
				raw.currentBalance = overrides.currentBalance;
			if (overrides.delivered !== undefined)
				raw.delivered = overrides.delivered;
			if (overrides.recipientEmail !== undefined)
				raw.recipientEmail = overrides.recipientEmail;
			await data.upsert("giftCard", card.id, raw);
		}
	}

	// Re-read to get final state
	const final = (await data.get("giftCard", card.id)) as unknown as {
		id: string;
		code: string;
		currentBalance: number;
		currency: string;
		status: string;
		customerId?: string;
	};
	return final;
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

describe("store endpoint: redeem — authentication and balance", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 when no session is provided", async () => {
		const result = await simulateRedeem(
			data,
			{ code: "ANY", amount: 1000 },
			null,
		);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("redeems the full requested amount when balance is sufficient", async () => {
		const card = await seedGiftCard(data, { initialBalance: 5000 });

		const result = await simulateRedeem(
			data,
			{ code: card.code, amount: 3000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			amountApplied: 3000,
			remainingBalance: 2000,
			currency: "USD",
		});
	});

	it("caps redemption to available balance", async () => {
		const card = await seedGiftCard(data, { initialBalance: 2000 });

		const result = await simulateRedeem(
			data,
			{ code: card.code, amount: 5000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			amountApplied: 2000,
			remainingBalance: 0,
			currency: "USD",
		});
	});

	it("returns 400 for an inactive card", async () => {
		const card = await seedGiftCard(data, {
			initialBalance: 5000,
			status: "disabled",
		});

		const result = await simulateRedeem(
			data,
			{ code: card.code, amount: 1000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Gift card not found, inactive, expired, or insufficient balance",
			status: 400,
		});
	});

	it("returns 400 for an expired card", async () => {
		const card = await seedGiftCard(data, {
			initialBalance: 5000,
			expiresAt: "2020-01-01T00:00:00.000Z",
		});

		const result = await simulateRedeem(
			data,
			{ code: card.code, amount: 1000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Gift card not found, inactive, expired, or insufficient balance",
			status: 400,
		});
	});

	it("returns 400 for a depleted card", async () => {
		const card = await seedGiftCard(data, {
			initialBalance: 5000,
			currentBalance: 0,
			status: "depleted",
		});

		const result = await simulateRedeem(
			data,
			{ code: card.code, amount: 1000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Gift card not found, inactive, expired, or insufficient balance",
			status: 400,
		});
	});

	it("returns 400 for a nonexistent code", async () => {
		const result = await simulateRedeem(
			data,
			{ code: "NONEXISTENT-CODE", amount: 1000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			error: "Gift card not found, inactive, expired, or insufficient balance",
			status: 400,
		});
	});

	it("marks card as depleted when entire balance is redeemed", async () => {
		const card = await seedGiftCard(data, { initialBalance: 3000 });

		const result = await simulateRedeem(
			data,
			{ code: card.code, amount: 3000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			amountApplied: 3000,
			remainingBalance: 0,
			currency: "USD",
		});

		// Subsequent check should show depleted
		const balanceCheck = await simulateCheckBalance(data, card.code);
		expect(balanceCheck).toEqual({
			balance: 0,
			currency: "USD",
			status: "depleted",
		});
	});

	it("supports partial redemption across multiple calls", async () => {
		const card = await seedGiftCard(data, { initialBalance: 5000 });

		const first = await simulateRedeem(
			data,
			{ code: card.code, amount: 2000 },
			{ userId: "cust_1" },
		);
		expect(first).toEqual({
			amountApplied: 2000,
			remainingBalance: 3000,
			currency: "USD",
		});

		const second = await simulateRedeem(
			data,
			{ code: card.code, amount: 1500 },
			{ userId: "cust_1" },
		);
		expect(second).toEqual({
			amountApplied: 1500,
			remainingBalance: 1500,
			currency: "USD",
		});
	});

	it("includes orderId in the transaction when provided", async () => {
		const card = await seedGiftCard(data, { initialBalance: 5000 });

		const result = await simulateRedeem(
			data,
			{ code: card.code, amount: 1000, orderId: "order_123" },
			{ userId: "cust_1" },
		);

		expect("amountApplied" in result).toBe(true);
		if ("amountApplied" in result) {
			expect(result.amountApplied).toBe(1000);
		}
	});
});

describe("store endpoint: purchase — session identity", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 when no session is provided", async () => {
		const result = await simulatePurchase(data, { amount: 5000 }, null);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("creates a gift card with correct balance and currency", async () => {
		const result = await simulatePurchase(
			data,
			{ amount: 5000, currency: "EUR" },
			{ userId: "cust_1", email: "buyer@example.com" },
		);

		expect("id" in result).toBe(true);
		if ("id" in result) {
			expect(result.balance).toBe(5000);
			expect(result.currency).toBe("EUR");
			expect(result.code).toMatch(/^GIFT-/);
		}
	});

	it("defaults to USD when no currency specified", async () => {
		const result = await simulatePurchase(
			data,
			{ amount: 2500 },
			{ userId: "cust_1", email: "buyer@example.com" },
		);

		expect("currency" in result).toBe(true);
		if ("currency" in result) {
			expect(result.currency).toBe("USD");
		}
	});

	it("sets recipientEmail when buying as a gift", async () => {
		const result = await simulatePurchase(
			data,
			{
				amount: 3000,
				recipientEmail: "friend@example.com",
				recipientName: "Friend",
				senderName: "Buyer",
				message: "Happy Birthday!",
			},
			{ userId: "cust_1", email: "buyer@example.com" },
		);

		expect("recipientEmail" in result).toBe(true);
		if ("recipientEmail" in result) {
			expect(result.recipientEmail).toBe("friend@example.com");
		}
	});

	it("assigns card to purchaser when no recipient specified", async () => {
		const result = await simulatePurchase(
			data,
			{ amount: 2000 },
			{ userId: "cust_1", email: "buyer@example.com" },
		);

		// Card should be in my-cards for cust_1
		expect("id" in result).toBe(true);
		if ("id" in result) {
			const myCards = await simulateMyCards(data, {}, { userId: "cust_1" });
			expect("cards" in myCards).toBe(true);
			if ("cards" in myCards) {
				expect(myCards.cards.some((c) => c.id === result.id)).toBe(true);
			}
		}
	});

	it("each purchase generates a unique code", async () => {
		const session = { userId: "cust_1", email: "buyer@example.com" };
		const result1 = await simulatePurchase(data, { amount: 1000 }, session);
		const result2 = await simulatePurchase(data, { amount: 1000 }, session);

		expect("code" in result1 && "code" in result2).toBe(true);
		if ("code" in result1 && "code" in result2) {
			expect(result1.code).not.toBe(result2.code);
		}
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

	it("allows the card owner to send their card", async () => {
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
		if ("delivered" in result) {
			expect(result.delivered).toBe(true);
			expect(result.recipientEmail).toBe("friend@example.com");
		}
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
		if ("delivered" in result) {
			expect(result.delivered).toBe(true);
		}
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
			error: "Gift card not found, not owned by you, or already sent",
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
			error: "Gift card not found, not owned by you, or already sent",
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
			error: "Gift card not found, not owned by you, or already sent",
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
			error: "Gift card not found, not owned by you, or already sent",
			status: 400,
		});
	});
});

describe("store endpoint: top-up — ownership enforcement", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns 401 when no session is provided", async () => {
		const result = await simulateTopUp(
			data,
			{ giftCardId: "any", amount: 1000 },
			null,
		);
		expect(result).toEqual({
			error: "Authentication required",
			status: 401,
		});
	});

	it("allows the card owner to top up their card", async () => {
		const card = await seedGiftCard(data, {
			customerId: "cust_1",
			initialBalance: 2000,
		});

		const result = await simulateTopUp(
			data,
			{ giftCardId: card.id, amount: 3000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			newBalance: 5000,
			currency: "USD",
			amountAdded: 3000,
		});
	});

	it("returns 400 when a non-owner tries to top up", async () => {
		const card = await seedGiftCard(data, { customerId: "cust_1" });

		const result = await simulateTopUp(
			data,
			{ giftCardId: card.id, amount: 1000 },
			{ userId: "cust_attacker" },
		);

		expect(result).toEqual({
			error:
				"Gift card not found, not owned by you, disabled, or invalid amount",
			status: 400,
		});
	});

	it("returns 400 for a disabled card", async () => {
		const card = await seedGiftCard(data, {
			customerId: "cust_1",
			status: "disabled",
		});

		const result = await simulateTopUp(
			data,
			{ giftCardId: card.id, amount: 1000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			error:
				"Gift card not found, not owned by you, disabled, or invalid amount",
			status: 400,
		});
	});

	it("returns 400 for a nonexistent card", async () => {
		const result = await simulateTopUp(
			data,
			{ giftCardId: "nonexistent", amount: 1000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			error:
				"Gift card not found, not owned by you, disabled, or invalid amount",
			status: 400,
		});
	});

	it("accumulates balance across multiple top-ups", async () => {
		const card = await seedGiftCard(data, {
			customerId: "cust_1",
			initialBalance: 1000,
		});

		const first = await simulateTopUp(
			data,
			{ giftCardId: card.id, amount: 2000 },
			{ userId: "cust_1" },
		);
		expect(first).toEqual({
			newBalance: 3000,
			currency: "USD",
			amountAdded: 2000,
		});

		const second = await simulateTopUp(
			data,
			{ giftCardId: card.id, amount: 500 },
			{ userId: "cust_1" },
		);
		expect(second).toEqual({
			newBalance: 3500,
			currency: "USD",
			amountAdded: 500,
		});
	});

	it("reactivates a depleted card on top-up", async () => {
		const card = await seedGiftCard(data, {
			customerId: "cust_1",
			initialBalance: 1000,
			currentBalance: 0,
			status: "depleted",
		});

		// Depleted cards can still be topped up — topUp checks for disabled, not depleted
		const result = await simulateTopUp(
			data,
			{ giftCardId: card.id, amount: 2000 },
			{ userId: "cust_1" },
		);

		expect(result).toEqual({
			newBalance: 2000,
			currency: "USD",
			amountAdded: 2000,
		});

		// Card should be active again
		const balance = await simulateCheckBalance(data, card.code);
		expect("status" in balance).toBe(true);
		if ("status" in balance) {
			expect(balance.status).toBe("active");
		}
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
		if ("cards" in result) {
			expect(result.cards).toHaveLength(2);
			expect(result.total).toBe(2);
			expect(
				result.cards.every(
					(c) => c.currentBalance === 3000 || c.currentBalance === 5000,
				),
			).toBe(true);
		}
	});

	it("returns empty list for a customer with no cards", async () => {
		await seedGiftCard(data, { customerId: "cust_other" });

		const result = await simulateMyCards(data, {}, { userId: "cust_1" });

		expect("cards" in result).toBe(true);
		if ("cards" in result) {
			expect(result.cards).toHaveLength(0);
			expect(result.total).toBe(0);
		}
	});

	it("shapes response with the correct fields", async () => {
		await seedGiftCard(data, {
			customerId: "cust_1",
			initialBalance: 5000,
			recipientEmail: "friend@example.com",
		});

		const result = await simulateMyCards(data, {}, { userId: "cust_1" });

		expect("cards" in result).toBe(true);
		if ("cards" in result) {
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
		}
	});

	it("does not expose cards from other customers", async () => {
		const otherCard = await seedGiftCard(data, {
			customerId: "cust_2",
			initialBalance: 10000,
		});

		const result = await simulateMyCards(data, {}, { userId: "cust_1" });

		expect("cards" in result).toBe(true);
		if ("cards" in result) {
			expect(result.cards.some((c) => c.id === otherCard.id)).toBe(false);
		}
	});
});

describe("store endpoint: redeem then check — cross-endpoint consistency", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("check-balance reflects the updated balance after partial redeem", async () => {
		const card = await seedGiftCard(data, { initialBalance: 10000 });

		await simulateRedeem(
			data,
			{ code: card.code, amount: 4000 },
			{ userId: "cust_1" },
		);

		const balance = await simulateCheckBalance(data, card.code);
		expect(balance).toEqual({
			balance: 6000,
			currency: "USD",
			status: "active",
		});
	});

	it("purchase then redeem full amount depletes the card", async () => {
		const session = { userId: "cust_1", email: "buyer@example.com" };
		const purchased = await simulatePurchase(data, { amount: 2500 }, session);

		expect("code" in purchased).toBe(true);
		if ("code" in purchased) {
			const redeemed = await simulateRedeem(
				data,
				{ code: purchased.code, amount: 2500 },
				{ userId: "cust_1" },
			);

			expect(redeemed).toEqual({
				amountApplied: 2500,
				remainingBalance: 0,
				currency: "USD",
			});

			const balance = await simulateCheckBalance(data, purchased.code);
			expect(balance).toEqual({
				balance: 0,
				currency: "USD",
				status: "depleted",
			});
		}
	});

	it("top-up restores balance after partial redeem", async () => {
		const card = await seedGiftCard(data, {
			customerId: "cust_1",
			initialBalance: 5000,
		});

		// Redeem 3000
		await simulateRedeem(
			data,
			{ code: card.code, amount: 3000 },
			{ userId: "cust_1" },
		);

		// Top up 4000
		const topUpResult = await simulateTopUp(
			data,
			{ giftCardId: card.id, amount: 4000 },
			{ userId: "cust_1" },
		);

		expect(topUpResult).toEqual({
			newBalance: 6000,
			currency: "USD",
			amountAdded: 4000,
		});

		// Check final balance
		const balance = await simulateCheckBalance(data, card.code);
		expect(balance).toEqual({
			balance: 6000,
			currency: "USD",
			status: "active",
		});
	});
});
