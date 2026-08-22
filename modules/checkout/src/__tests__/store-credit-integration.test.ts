import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import type { CheckoutLineItem, StoreCreditCheckController } from "../service";
import { createCheckoutController } from "../service-impl";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sampleLineItems: CheckoutLineItem[] = [
	{ productId: "p1", name: "Widget", price: 1000, quantity: 2 },
	{ productId: "p2", name: "Gadget", price: 2000, quantity: 1 },
];

function makeSession(overrides: Record<string, unknown> = {}) {
	return {
		subtotal: 4000,
		taxAmount: 400,
		shippingAmount: 500,
		total: 4900,
		lineItems: sampleLineItems,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// applyStoreCredit
// ---------------------------------------------------------------------------

describe("applyStoreCredit", () => {
	it("applies store credit amount and recalculates total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyStoreCredit(session.id, {
			storeCreditAmount: 1200,
		});

		expect(updated?.storeCreditAmount).toBe(1200);
		// 4000 + 400 + 500 - 0 (discount) - 0 (gift card) - 1200 (store credit) = 3700
		expect(updated?.total).toBe(3700);
	});

	it("clamps total to zero (no negative totals)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyStoreCredit(session.id, {
			storeCreditAmount: 99999,
		});

		expect(updated?.storeCreditAmount).toBe(99999);
		expect(updated?.total).toBe(0);
	});

	it("works alongside a discount (both deductions stack)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});

		const updated = await ctrl.applyStoreCredit(session.id, {
			storeCreditAmount: 1000,
		});

		expect(updated?.discountAmount).toBe(500);
		expect(updated?.storeCreditAmount).toBe(1000);
		// 4000 + 400 + 500 - 500 - 0 - 1000 = 3400
		expect(updated?.total).toBe(3400);
	});

	it("works alongside a gift card (all three deductions stack)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		await ctrl.applyDiscount(session.id, {
			code: "SAVE200",
			discountAmount: 200,
			freeShipping: false,
		});
		await ctrl.applyGiftCard(session.id, {
			code: "GIFT-ABCD",
			giftCardAmount: 500,
		});
		const updated = await ctrl.applyStoreCredit(session.id, {
			storeCreditAmount: 300,
		});

		expect(updated?.discountAmount).toBe(200);
		expect(updated?.giftCardAmount).toBe(500);
		expect(updated?.storeCreditAmount).toBe(300);
		// 4000 + 400 + 500 - 200 - 500 - 300 = 3900
		expect(updated?.total).toBe(3900);
	});

	it("returns null for a completed session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		const result = await ctrl.applyStoreCredit(session.id, {
			storeCreditAmount: 100,
		});
		expect(result).toBeNull();
	});

	it("returns null for a missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const result = await ctrl.applyStoreCredit("ghost", {
			storeCreditAmount: 100,
		});
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// removeStoreCredit
// ---------------------------------------------------------------------------

describe("removeStoreCredit", () => {
	it("removes store credit and restores original total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.applyStoreCredit(session.id, { storeCreditAmount: 1200 });

		const restored = await ctrl.removeStoreCredit(session.id);

		expect(restored?.storeCreditAmount).toBe(0);
		// subtotal=4000 + tax=400 + shipping=500 = 4900
		expect(restored?.total).toBe(4900);
	});

	it("preserves discount and gift card when removing store credit", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});
		await ctrl.applyGiftCard(session.id, {
			code: "GIFT-1234",
			giftCardAmount: 600,
		});
		await ctrl.applyStoreCredit(session.id, { storeCreditAmount: 400 });

		const restored = await ctrl.removeStoreCredit(session.id);

		expect(restored?.discountCode).toBe("SAVE500");
		expect(restored?.discountAmount).toBe(500);
		expect(restored?.giftCardAmount).toBe(600);
		expect(restored?.storeCreditAmount).toBe(0);
		// 4000 + 400 + 500 - 500 - 600 - 0 = 3800
		expect(restored?.total).toBe(3800);
	});

	it("returns null for a missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		expect(await ctrl.removeStoreCredit("nope")).toBeNull();
	});

	it("returns null for a completed session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		expect(await ctrl.removeStoreCredit(session.id)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// storeCreditAmount in create
// ---------------------------------------------------------------------------

describe("create with storeCreditAmount", () => {
	it("initializes storeCreditAmount to 0 by default", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		expect(session.storeCreditAmount).toBe(0);
	});

	it("accepts storeCreditAmount in create params", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ storeCreditAmount: 500 }));
		expect(session.storeCreditAmount).toBe(500);
	});
});

// ---------------------------------------------------------------------------
// complete-session store credit debit logic
// ---------------------------------------------------------------------------

type DebitCall = {
	customerId: string;
	amount: number;
	reason: string;
	referenceId?: string | undefined;
};

function createMockStoreCreditController(opts?: {
	balance?: number;
	failDebit?: boolean;
}): StoreCreditCheckController & { _debitCalls: DebitCall[] } {
	const balance = opts?.balance ?? 5000;
	let currentBalance = balance;
	const debitCalls: DebitCall[] = [];

	return {
		_debitCalls: debitCalls,

		async getBalance(_customerId) {
			return currentBalance;
		},

		async debit(params) {
			debitCalls.push({
				customerId: params.customerId,
				amount: params.amount,
				reason: params.reason,
				referenceId: params.referenceId,
			});

			if (opts?.failDebit) throw new Error("Account frozen");

			const deducted = Math.min(params.amount, currentBalance);
			currentBalance -= deducted;

			return {
				id: `txn_${crypto.randomUUID().slice(0, 8)}`,
				amount: deducted,
				balanceAfter: currentBalance,
			};
		},
	};
}

/**
 * Simulates the complete-session endpoint logic for store credits:
 * 1. Debit store credits BEFORE creating the order
 * 2. Adjust total if actual debited amount differs
 */
async function simulateCompleteWithStoreCredit(
	checkoutCtrl: ReturnType<typeof createCheckoutController>,
	sessionId: string,
	opts?: {
		storeCreditCtrl?: StoreCreditCheckController | undefined;
	},
) {
	const existing = await checkoutCtrl.getById(sessionId);
	if (!existing) return { error: "Not found", status: 404 };

	let actualStoreCreditAmount = existing.storeCreditAmount;
	if (
		existing.customerId &&
		existing.storeCreditAmount > 0 &&
		opts?.storeCreditCtrl
	) {
		try {
			const debitResult = await opts.storeCreditCtrl.debit({
				customerId: existing.customerId,
				amount: existing.storeCreditAmount,
				reason: "order_payment",
				description: `Store credit applied to checkout ${existing.id}`,
				referenceType: "checkout_session",
				referenceId: existing.id,
			});
			actualStoreCreditAmount = debitResult.amount;
		} catch {
			return {
				error:
					"Store credit could not be applied. Your balance may be insufficient or your account may be frozen.",
				status: 422,
			};
		}
	}

	const adjustedTotal =
		actualStoreCreditAmount !== existing.storeCreditAmount
			? Math.max(
					0,
					existing.subtotal +
						existing.taxAmount +
						existing.shippingAmount -
						existing.discountAmount -
						existing.giftCardAmount -
						actualStoreCreditAmount,
				)
			: existing.total;

	const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
	const session = await checkoutCtrl.complete(sessionId, orderId);
	if (!session) return { error: "Cannot complete", status: 422 };

	return { session, orderId, actualStoreCreditAmount, adjustedTotal };
}

describe("complete-session store credit debit", () => {
	it("debits store credit before completing the session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const scCtrl = createMockStoreCreditController({ balance: 5000 });

		const session = await ctrl.create(
			makeSession({ customerId: "cust-1", storeCreditAmount: 1200 }),
		);
		await ctrl.applyStoreCredit(session.id, { storeCreditAmount: 1200 });

		const result = await simulateCompleteWithStoreCredit(ctrl, session.id, {
			storeCreditCtrl: scCtrl,
		});

		expect(scCtrl._debitCalls).toHaveLength(1);
		expect(scCtrl._debitCalls[0].customerId).toBe("cust-1");
		expect(scCtrl._debitCalls[0].amount).toBe(1200);
		expect(scCtrl._debitCalls[0].reason).toBe("order_payment");

		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.status).toBe("completed");
	});

	it("rejects completion when store credit debit fails", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const scCtrl = createMockStoreCreditController({ failDebit: true });

		const session = await ctrl.create(makeSession({ customerId: "cust-1" }));
		await ctrl.applyStoreCredit(session.id, { storeCreditAmount: 500 });

		const result = await simulateCompleteWithStoreCredit(ctrl, session.id, {
			storeCreditCtrl: scCtrl,
		});

		expect("error" in result).toBe(true);
		if (!("error" in result)) {
			throw new Error("expected 'error' in result");
		}
		expect(result.error).toContain("Store credit could not be applied");
		expect(result.status).toBe(422);
	});

	it("does not debit when storeCreditAmount is zero", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const scCtrl = createMockStoreCreditController();

		const session = await ctrl.create(makeSession({ customerId: "cust-1" }));
		// No store credit applied

		await simulateCompleteWithStoreCredit(ctrl, session.id, {
			storeCreditCtrl: scCtrl,
		});

		expect(scCtrl._debitCalls).toHaveLength(0);
	});

	it("does not debit when no customerId is set (guest)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const scCtrl = createMockStoreCreditController();

		const session = await ctrl.create(
			makeSession({ guestEmail: "guest@example.com" }),
		);
		// Force a storeCreditAmount with no customerId
		await ctrl.applyStoreCredit(session.id, { storeCreditAmount: 500 });

		const result = await simulateCompleteWithStoreCredit(ctrl, session.id, {
			storeCreditCtrl: scCtrl,
		});

		// No debit should happen (no customerId)
		expect(scCtrl._debitCalls).toHaveLength(0);
		expect("session" in result).toBe(true);
	});

	it("completes without store credits module (no storeCreditCtrl)", async () => {
		const ctrl = createCheckoutController(createMockDataService());

		const session = await ctrl.create(makeSession({ customerId: "cust-1" }));
		await ctrl.applyStoreCredit(session.id, { storeCreditAmount: 600 });

		const result = await simulateCompleteWithStoreCredit(ctrl, session.id, {
			storeCreditCtrl: undefined,
		});

		// Should complete using the session's stored storeCreditAmount
		expect("session" in result).toBe(true);
		if (!("session" in result)) {
			throw new Error("expected 'session' in result");
		}
		expect(result.session.status).toBe("completed");
	});
});
