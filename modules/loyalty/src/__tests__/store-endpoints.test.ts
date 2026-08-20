import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { LoyaltyController } from "../service";
import { createLoyaltyController } from "../service-impl";

/**
 * Store endpoint integration tests for the loyalty module.
 *
 * Tests verify:
 *
 * 1. get-balance — auth, auto-creates account, returns tier info
 * 2. list-transactions — auth, scoped to customer's account
 * 3. redeem — auth, balance checks, insufficient points rejection
 * 4. calculate-points — order amount to points calculation using rules
 * 5. get-tiers — public tier list with thresholds
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────────

async function simulateGetBalance(
	controller: LoyaltyController,
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const account = await controller.getOrCreateAccount(session.userId);
	return {
		balance: account.balance,
		lifetimeEarned: account.lifetimeEarned,
		lifetimeRedeemed: account.lifetimeRedeemed,
		tier: account.tier,
		status: account.status,
	};
}

async function simulateListTransactions(
	controller: LoyaltyController,
	query: { take?: number; skip?: number; type?: string },
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const account = await controller.getAccount(session.userId);
	if (!account) return { transactions: [] };
	const transactions = await controller.listTransactions(account.id, {
		take: query.take,
		skip: query.skip,
		...(query.type ? { type: query.type as "earn" | "redeem" | "adjust" } : {}),
	});
	return { transactions };
}

async function simulateRedeem(
	controller: LoyaltyController,
	body: { points: number; description?: string; orderId?: string },
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const account = await controller.getAccount(session.userId);
	if (!account) return { error: "No loyalty account", status: 404 };
	if (account.balance < body.points) {
		return { error: "Insufficient points", status: 400 };
	}
	const transaction = await controller.redeemPoints({
		customerId: session.userId,
		points: body.points,
		description: body.description ?? "Points redemption",
		orderId: body.orderId,
	});
	return { transaction };
}

async function simulateCalculatePoints(
	controller: LoyaltyController,
	query: { orderAmount: number },
) {
	const points = await controller.calculateOrderPoints(query.orderAmount);
	return { points };
}

async function simulateGetTiers(controller: LoyaltyController) {
	const tiers = await controller.listTiers();
	return { tiers };
}

// ── Tests ───────────────────────────────────────────────────────────────

let data: DataService;
let controller: LoyaltyController;

beforeEach(() => {
	data = createMockDataService();
	controller = createLoyaltyController(data);
});

describe("get-balance (GET /loyalty/balance)", () => {
	it("requires authentication", async () => {
		const result = await simulateGetBalance(controller, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("auto-creates account and returns zero balance", async () => {
		const result = await simulateGetBalance(controller, {
			userId: "cust_1",
		});
		expect("balance" in result).toBe(true);
		if ("balance" in result) {
			expect(result.balance).toBe(0);
			expect(result.tier).toBe("bronze");
			expect(result.status).toBe("active");
		}
	});

	it("returns current balance after earning points", async () => {
		await controller.earnPoints({
			customerId: "cust_1",
			points: 500,
			description: "Purchase",
		});

		const result = await simulateGetBalance(controller, {
			userId: "cust_1",
		});
		if ("balance" in result) {
			expect(result.balance).toBe(500);
			expect(result.lifetimeEarned).toBe(500);
			expect(result.tier).toBe("silver");
		}
	});
});

describe("list-transactions (GET /loyalty/transactions)", () => {
	it("requires authentication", async () => {
		const result = await simulateListTransactions(controller, {}, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns transaction history", async () => {
		await controller.earnPoints({
			customerId: "cust_1",
			points: 100,
			description: "Order #1",
		});
		await controller.earnPoints({
			customerId: "cust_1",
			points: 200,
			description: "Order #2",
		});

		const result = await simulateListTransactions(
			controller,
			{},
			{ userId: "cust_1" },
		);
		expect("transactions" in result).toBe(true);
		if ("transactions" in result) {
			expect(result.transactions).toHaveLength(2);
		}
	});

	it("returns empty list for new customer", async () => {
		const result = await simulateListTransactions(
			controller,
			{},
			{ userId: "cust_new" },
		);
		if ("transactions" in result) {
			expect(result.transactions).toHaveLength(0);
		}
	});

	it("filters by transaction type", async () => {
		await controller.earnPoints({
			customerId: "cust_1",
			points: 500,
			description: "Purchase",
		});
		await controller.redeemPoints({
			customerId: "cust_1",
			points: 100,
			description: "Discount",
		});

		const earns = await simulateListTransactions(
			controller,
			{ type: "earn" },
			{ userId: "cust_1" },
		);
		if ("transactions" in earns) {
			expect(earns.transactions).toHaveLength(1);
			expect(earns.transactions[0].type).toBe("earn");
		}
	});
});

describe("redeem (POST /loyalty/redeem)", () => {
	it("requires authentication", async () => {
		const result = await simulateRedeem(controller, { points: 100 }, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("redeems points successfully", async () => {
		await controller.earnPoints({
			customerId: "cust_1",
			points: 500,
			description: "Purchase",
		});

		const result = await simulateRedeem(
			controller,
			{ points: 200, description: "Checkout discount" },
			{ userId: "cust_1" },
		);
		expect("transaction" in result).toBe(true);
		if ("transaction" in result) {
			expect(result.transaction.type).toBe("redeem");
			expect(result.transaction.points).toBe(200);
		}

		// Verify balance decreased
		const balance = await simulateGetBalance(controller, {
			userId: "cust_1",
		});
		if ("balance" in balance) {
			expect(balance.balance).toBe(300);
		}
	});

	it("rejects redemption with insufficient points", async () => {
		await controller.earnPoints({
			customerId: "cust_1",
			points: 50,
			description: "Small order",
		});

		const result = await simulateRedeem(
			controller,
			{ points: 100 },
			{ userId: "cust_1" },
		);
		expect(result).toEqual({
			error: "Insufficient points",
			status: 400,
		});
	});

	it("returns 404 for customer with no account", async () => {
		const result = await simulateRedeem(
			controller,
			{ points: 100 },
			{ userId: "cust_new" },
		);
		expect(result).toEqual({
			error: "No loyalty account",
			status: 404,
		});
	});
});

describe("calculate-points (GET /loyalty/calculate)", () => {
	it("returns 0 when no rules exist", async () => {
		const result = await simulateCalculatePoints(controller, {
			orderAmount: 5000,
		});
		expect(result.points).toBe(0);
	});

	it("calculates points using per_dollar rule", async () => {
		await controller.createRule({
			name: "1 point per dollar",
			type: "per_dollar",
			points: 1,
		});

		const result = await simulateCalculatePoints(controller, {
			orderAmount: 5000,
		});
		expect(result.points).toBe(5000);
	});

	it("calculates with minimum order threshold", async () => {
		await controller.createRule({
			name: "Bonus 100 on $50+",
			type: "fixed_bonus",
			points: 100,
			minOrderAmount: 5000,
		});

		const below = await simulateCalculatePoints(controller, {
			orderAmount: 4999,
		});
		expect(below.points).toBe(0);

		const above = await simulateCalculatePoints(controller, {
			orderAmount: 5000,
		});
		expect(above.points).toBe(100);
	});
});

describe("get-tiers (GET /loyalty/tiers)", () => {
	it("returns empty list when no custom tiers are configured", async () => {
		const result = await simulateGetTiers(controller);
		expect(result.tiers).toHaveLength(0);
	});

	it("returns custom tiers when configured", async () => {
		await controller.createTier({
			name: "Bronze",
			slug: "bronze",
			minPoints: 0,
		});
		await controller.createTier({
			name: "Gold",
			slug: "gold",
			minPoints: 1000,
		});

		const result = await simulateGetTiers(controller);
		expect(result.tiers).toHaveLength(2);
	});
});

describe("cross-endpoint lifecycle", () => {
	it("earn → check balance → redeem → verify transactions", async () => {
		const session = { userId: "cust_1" };

		// Earn points
		await controller.earnPoints({
			customerId: "cust_1",
			points: 1000,
			description: "Big purchase",
		});

		// Check balance
		const balance = await simulateGetBalance(controller, session);
		if ("balance" in balance) {
			expect(balance.balance).toBe(1000);
			expect(balance.tier).toBe("silver");
		}

		// Redeem
		const redeemed = await simulateRedeem(
			controller,
			{ points: 300, description: "Discount on next order" },
			session,
		);
		expect("transaction" in redeemed).toBe(true);

		// Verify balance
		const after = await simulateGetBalance(controller, session);
		if ("balance" in after) {
			expect(after.balance).toBe(700);
			expect(after.lifetimeRedeemed).toBe(300);
		}

		// Verify transactions list
		const txns = await simulateListTransactions(controller, {}, session);
		if ("transactions" in txns) {
			expect(txns.transactions).toHaveLength(2);
		}
	});
});
