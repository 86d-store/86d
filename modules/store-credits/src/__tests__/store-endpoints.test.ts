import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { StoreCreditController } from "../service";
import { createStoreCreditController } from "../service-impl";

/**
 * Store endpoint integration tests for the store-credits module.
 *
 * Tests verify:
 *
 * 1. get-balance — auth, auto-creates account, returns balance + currency
 * 2. list-transactions — auth, scoped to customer's account
 * 3. apply-credit — auth, balance checks, insufficient balance rejection
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────────

async function simulateGetBalance(
	controller: StoreCreditController,
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const account = await controller.getOrCreateAccount(session.userId);
	return {
		balance: account.balance,
		currency: account.currency,
		lifetimeCredited: account.lifetimeCredited,
		lifetimeDebited: account.lifetimeDebited,
	};
}

async function simulateListTransactions(
	controller: StoreCreditController,
	query: { take?: number; skip?: number },
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const account = await controller.getAccount(session.userId);
	if (!account) return { transactions: [] };
	const transactions = await controller.listTransactions(account.id, {
		take: query.take,
		skip: query.skip,
	});
	return { transactions };
}

async function simulateApplyCredit(
	controller: StoreCreditController,
	body: { amount: number; orderId?: string },
	session: { userId: string } | null,
) {
	if (!session) return { error: "Unauthorized", status: 401 };
	const account = await controller.getAccount(session.userId);
	if (!account) return { error: "No store credit account", status: 404 };
	if (account.status !== "active") {
		return { error: "Account is not active", status: 400 };
	}
	if (account.balance < body.amount) {
		return { error: "Insufficient store credit balance", status: 400 };
	}
	const transaction = await controller.debit({
		customerId: session.userId,
		amount: body.amount,
		reason: "order_payment",
		description: "Applied to order",
		referenceType: body.orderId ? "order" : undefined,
		referenceId: body.orderId,
	});
	return { transaction, remainingBalance: transaction.balanceAfter };
}

// ── Tests ───────────────────────────────────────────────────────────────

let data: DataService;
let controller: StoreCreditController;

beforeEach(() => {
	data = createMockDataService();
	controller = createStoreCreditController(data);
});

describe("get-balance (GET /store-credits/balance)", () => {
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
			expect(result.currency).toBe("USD");
		}
	});

	it("returns current balance after credits", async () => {
		await controller.credit({
			customerId: "cust_1",
			amount: 5000,
			reason: "return_refund",
			description: "Order refund",
		});

		const result = await simulateGetBalance(controller, {
			userId: "cust_1",
		});
		if ("balance" in result) {
			expect(result.balance).toBe(5000);
			expect(result.lifetimeCredited).toBe(5000);
		}
	});
});

describe("list-transactions (GET /store-credits/transactions)", () => {
	it("requires authentication", async () => {
		const result = await simulateListTransactions(controller, {}, null);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("returns transaction history", async () => {
		await controller.credit({
			customerId: "cust_1",
			amount: 3000,
			reason: "return_refund",
			description: "Refund #1",
		});
		await controller.credit({
			customerId: "cust_1",
			amount: 2000,
			reason: "promotional",
			description: "Welcome bonus",
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

	it("returns empty for customer with no account", async () => {
		const result = await simulateListTransactions(
			controller,
			{},
			{ userId: "cust_new" },
		);
		if ("transactions" in result) {
			expect(result.transactions).toHaveLength(0);
		}
	});

	it("paginates with take/skip", async () => {
		await controller.credit({
			customerId: "cust_1",
			amount: 5000,
			reason: "return_refund",
			description: "Initial",
		});
		for (let i = 0; i < 4; i++) {
			await controller.debit({
				customerId: "cust_1",
				amount: 500,
				reason: "order_payment",
				description: `Order ${i}`,
			});
		}

		const page1 = await simulateListTransactions(
			controller,
			{ take: 2, skip: 0 },
			{ userId: "cust_1" },
		);
		if ("transactions" in page1) {
			expect(page1.transactions).toHaveLength(2);
		}
	});
});

describe("apply-credit (POST /store-credits/apply)", () => {
	it("requires authentication", async () => {
		const result = await simulateApplyCredit(
			controller,
			{ amount: 1000 },
			null,
		);
		expect(result).toEqual({ error: "Unauthorized", status: 401 });
	});

	it("applies credit to an order", async () => {
		await controller.credit({
			customerId: "cust_1",
			amount: 5000,
			reason: "return_refund",
			description: "Refund",
		});

		const result = await simulateApplyCredit(
			controller,
			{ amount: 2000, orderId: "order_1" },
			{ userId: "cust_1" },
		);
		expect("transaction" in result).toBe(true);
		if ("transaction" in result) {
			expect(result.transaction.amount).toBe(2000);
			expect(result.remainingBalance).toBe(3000);
		}
	});

	it("rejects when insufficient balance", async () => {
		await controller.credit({
			customerId: "cust_1",
			amount: 1000,
			reason: "return_refund",
			description: "Small refund",
		});

		const result = await simulateApplyCredit(
			controller,
			{ amount: 2000 },
			{ userId: "cust_1" },
		);
		expect(result).toEqual({
			error: "Insufficient store credit balance",
			status: 400,
		});
	});

	it("returns 404 for customer with no account", async () => {
		const result = await simulateApplyCredit(
			controller,
			{ amount: 100 },
			{ userId: "cust_new" },
		);
		expect(result).toEqual({
			error: "No store credit account",
			status: 404,
		});
	});

	it("rejects when account is frozen", async () => {
		await controller.credit({
			customerId: "cust_1",
			amount: 5000,
			reason: "return_refund",
			description: "Refund",
		});
		await controller.freezeAccount("cust_1");

		const result = await simulateApplyCredit(
			controller,
			{ amount: 1000 },
			{ userId: "cust_1" },
		);
		expect(result).toEqual({
			error: "Account is not active",
			status: 400,
		});
	});
});

describe("cross-endpoint lifecycle", () => {
	it("credit → balance → apply → verify", async () => {
		const session = { userId: "cust_1" };

		// Get initial balance (auto-creates)
		const initial = await simulateGetBalance(controller, session);
		if ("balance" in initial) {
			expect(initial.balance).toBe(0);
		}

		// Admin issues credit
		await controller.credit({
			customerId: "cust_1",
			amount: 10000,
			reason: "return_refund",
			description: "Full order refund",
		});

		// Check balance
		const afterCredit = await simulateGetBalance(controller, session);
		if ("balance" in afterCredit) {
			expect(afterCredit.balance).toBe(10000);
		}

		// Apply to order
		const applied = await simulateApplyCredit(
			controller,
			{ amount: 3500, orderId: "order_42" },
			session,
		);
		if ("transaction" in applied) {
			expect(applied.remainingBalance).toBe(6500);
		}

		// Verify transactions
		const txns = await simulateListTransactions(controller, {}, session);
		if ("transactions" in txns) {
			expect(txns.transactions).toHaveLength(2); // credit + debit
		}

		// Verify final balance
		const final = await simulateGetBalance(controller, session);
		if ("balance" in final) {
			expect(final.balance).toBe(6500);
			expect(final.lifetimeDebited).toBe(3500);
		}
	});
});
