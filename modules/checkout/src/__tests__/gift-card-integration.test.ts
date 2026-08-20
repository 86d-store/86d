import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import type {
	CheckoutLineItem,
	GiftCardCheckController,
	OrderCreateController,
} from "../service";
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
// applyGiftCard
// ---------------------------------------------------------------------------

describe("applyGiftCard", () => {
	it("applies gift card amount and recalculates total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		// subtotal=4000 tax=400 shipping=500 total=4900
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyGiftCard(session.id, {
			code: "GIFT-ABCD-EFGH-JKLM",
			giftCardAmount: 1500,
		});

		expect(updated?.giftCardCode).toBe("GIFT-ABCD-EFGH-JKLM");
		expect(updated?.giftCardAmount).toBe(1500);
		// 4000 + 400 + 500 - 0 (discount) - 1500 (gift card) = 3400
		expect(updated?.total).toBe(3400);
	});

	it("clamps total to zero (no negative totals)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		const updated = await ctrl.applyGiftCard(session.id, {
			code: "BIG-CARD",
			giftCardAmount: 99999,
		});

		expect(updated?.giftCardAmount).toBe(99999);
		expect(updated?.total).toBe(0);
	});

	it("works alongside a discount (both deductions stack)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		// Apply discount first
		await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});

		// Then apply gift card
		const updated = await ctrl.applyGiftCard(session.id, {
			code: "GIFT-1234",
			giftCardAmount: 1000,
		});

		expect(updated?.discountAmount).toBe(500);
		expect(updated?.giftCardAmount).toBe(1000);
		// 4000 + 400 + 500 - 500 - 1000 = 3400
		expect(updated?.total).toBe(3400);
	});

	it("returns null for a completed session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		const result = await ctrl.applyGiftCard(session.id, {
			code: "X",
			giftCardAmount: 100,
		});
		expect(result).toBeNull();
	});

	it("returns null for a missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const result = await ctrl.applyGiftCard("ghost", {
			code: "X",
			giftCardAmount: 100,
		});
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// removeGiftCard
// ---------------------------------------------------------------------------

describe("removeGiftCard", () => {
	it("removes gift card and restores original total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.applyGiftCard(session.id, {
			code: "GIFT-1234",
			giftCardAmount: 1500,
		});

		const restored = await ctrl.removeGiftCard(session.id);

		expect(restored?.giftCardCode).toBeUndefined();
		expect(restored?.giftCardAmount).toBe(0);
		// subtotal=4000 + tax=400 + shipping=500 = 4900
		expect(restored?.total).toBe(4900);
	});

	it("preserves discount when removing gift card", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});
		await ctrl.applyGiftCard(session.id, {
			code: "GIFT-1234",
			giftCardAmount: 1000,
		});

		const restored = await ctrl.removeGiftCard(session.id);

		expect(restored?.discountCode).toBe("SAVE500");
		expect(restored?.discountAmount).toBe(500);
		expect(restored?.giftCardCode).toBeUndefined();
		expect(restored?.giftCardAmount).toBe(0);
		// 4000 + 400 + 500 - 500 = 4400
		expect(restored?.total).toBe(4400);
	});

	it("returns null for a missing session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		expect(await ctrl.removeGiftCard("nope")).toBeNull();
	});

	it("returns null for a completed session", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		await ctrl.complete(session.id, "order-1");
		expect(await ctrl.removeGiftCard(session.id)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// Gift card amount preserves across discount operations
// ---------------------------------------------------------------------------

describe("discount + gift card interaction", () => {
	it("applyDiscount preserves gift card amount in total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		// Apply gift card first
		await ctrl.applyGiftCard(session.id, {
			code: "GIFT-1234",
			giftCardAmount: 1000,
		});

		// Then apply discount
		const updated = await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});

		// 4000 + 400 + 500 - 500 - 1000 = 3400
		expect(updated?.total).toBe(3400);
	});

	it("removeDiscount preserves gift card amount in total", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		await ctrl.applyGiftCard(session.id, {
			code: "GIFT-1234",
			giftCardAmount: 1000,
		});
		await ctrl.applyDiscount(session.id, {
			code: "SAVE500",
			discountAmount: 500,
			freeShipping: false,
		});

		const restored = await ctrl.removeDiscount(session.id);

		expect(restored?.giftCardAmount).toBe(1000);
		// 4000 + 400 + 500 - 0 - 1000 = 3900
		expect(restored?.total).toBe(3900);
	});

	it("shipping recalculation preserves gift card amount", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());

		await ctrl.applyGiftCard(session.id, {
			code: "GIFT-1234",
			giftCardAmount: 1000,
		});

		const updated = await ctrl.update(session.id, { shippingAmount: 1000 });

		// 4000 + 400 + 1000 - 0 - 1000 = 4400
		expect(updated?.total).toBe(4400);
	});
});

// ---------------------------------------------------------------------------
// giftCardAmount in create
// ---------------------------------------------------------------------------

describe("create with giftCardAmount", () => {
	it("initializes giftCardAmount to 0 by default", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession());
		expect(session.giftCardAmount).toBe(0);
	});

	it("accepts giftCardAmount in create params", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const session = await ctrl.create(makeSession({ giftCardAmount: 500 }));
		expect(session.giftCardAmount).toBe(500);
	});
});

// ---------------------------------------------------------------------------
// Complete-session gift card redemption logic (mirrors endpoint behavior)
// ---------------------------------------------------------------------------

function createMockGiftCardController(opts?: {
	balance?: number;
	failRedeem?: boolean;
}): GiftCardCheckController & {
	_redeemCalls: Array<{
		code: string;
		amount: number;
		orderId?: string | undefined;
	}>;
} {
	const balance = opts?.balance ?? 5000;
	let currentBalance = balance;
	const redeemCalls: Array<{
		code: string;
		amount: number;
		orderId?: string | undefined;
	}> = [];

	return {
		_redeemCalls: redeemCalls,

		async checkBalance(_code) {
			if (currentBalance <= 0)
				return { balance: 0, currency: "USD", status: "depleted" };
			return { balance: currentBalance, currency: "USD", status: "active" };
		},

		async redeem(code, amount, orderId) {
			redeemCalls.push({ code, amount, orderId });

			if (opts?.failRedeem) return null;
			if (currentBalance <= 0) return null;

			const debit = Math.min(amount, currentBalance);
			currentBalance -= debit;

			return {
				transaction: {
					id: `txn_${crypto.randomUUID().slice(0, 8)}`,
					amount: debit,
					balanceAfter: currentBalance,
				},
				giftCard: {
					id: "gc_1",
					currentBalance,
					status: currentBalance === 0 ? "depleted" : "active",
				},
			};
		},
	};
}

function createMockOrderController(): OrderCreateController & {
	_orders: Array<{
		id: string;
		giftCardAmount: number;
		total: number;
	}>;
} {
	const orders: Array<{ id: string; giftCardAmount: number; total: number }> =
		[];

	return {
		_orders: orders,

		async create(params) {
			const id = `ORD-${crypto.randomUUID().slice(0, 8)}`;
			orders.push({
				id,
				giftCardAmount: params.giftCardAmount ?? 0,
				total: params.total,
			});
			return { id, orderNumber: `ORD-${id.slice(0, 8).toUpperCase()}` };
		},
	};
}

/**
 * Simulates the complete-session endpoint logic (matching the real implementation):
 * 1. Redeem gift card FIRST
 * 2. Adjust total if actual redeemed amount differs
 * 3. Create order with correct amounts
 * 4. Complete the session
 */
async function simulateCompleteWithGiftCard(
	checkoutCtrl: ReturnType<typeof createCheckoutController>,
	sessionId: string,
	opts?: {
		giftCardCtrl?: GiftCardCheckController | undefined;
		orderCtrl?: OrderCreateController | undefined;
	},
) {
	const existing = await checkoutCtrl.getById(sessionId);
	if (!existing) return { error: "Not found", status: 404 };

	// Step 1: Redeem gift card BEFORE creating the order
	let actualGiftCardAmount = existing.giftCardAmount;
	if (
		existing.giftCardCode &&
		existing.giftCardAmount > 0 &&
		opts?.giftCardCtrl
	) {
		const redeemResult = await opts.giftCardCtrl.redeem(
			existing.giftCardCode,
			existing.giftCardAmount,
		);

		if (!redeemResult) {
			return {
				error:
					"Gift card could not be redeemed. It may be expired, inactive, or have insufficient balance.",
				status: 422,
			};
		}

		actualGiftCardAmount = redeemResult.transaction.amount;
	}

	// Step 2: Recalculate total if needed
	const adjustedTotal =
		actualGiftCardAmount !== existing.giftCardAmount
			? existing.subtotal +
				existing.taxAmount +
				existing.shippingAmount -
				existing.discountAmount -
				actualGiftCardAmount
			: existing.total;

	// Step 3: Create order with correct amounts
	let orderId: string | undefined;
	if (opts?.orderCtrl) {
		const lineItems = await checkoutCtrl.getLineItems(sessionId);
		const order = await opts.orderCtrl.create({
			subtotal: existing.subtotal,
			taxAmount: existing.taxAmount,
			shippingAmount: existing.shippingAmount,
			discountAmount: existing.discountAmount,
			giftCardAmount: actualGiftCardAmount,
			total: adjustedTotal,
			items: lineItems.map((item) => ({
				productId: item.productId,
				name: item.name,
				price: item.price,
				quantity: item.quantity,
			})),
		});
		orderId = order.id;
	}

	if (!orderId) {
		orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
	}

	// Step 4: Complete the session
	const session = await checkoutCtrl.complete(sessionId, orderId);
	if (!session) return { error: "Cannot complete", status: 422 };

	return { session, orderId, actualGiftCardAmount, adjustedTotal };
}

describe("complete-session gift card redemption", () => {
	it("redeems gift card before creating the order", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const gcCtrl = createMockGiftCardController({ balance: 5000 });
		const orderCtrl = createMockOrderController();

		const session = await ctrl.create(makeSession({ customerId: "cust-1" }));
		await ctrl.applyGiftCard(session.id, {
			code: "GIFT-TEST-1234-5678",
			giftCardAmount: 1500,
		});

		const result = await simulateCompleteWithGiftCard(ctrl, session.id, {
			giftCardCtrl: gcCtrl,
			orderCtrl,
		});

		// Gift card should be redeemed
		expect(gcCtrl._redeemCalls).toHaveLength(1);
		expect(gcCtrl._redeemCalls[0].code).toBe("GIFT-TEST-1234-5678");
		expect(gcCtrl._redeemCalls[0].amount).toBe(1500);

		// Order should have the correct gift card amount
		expect(orderCtrl._orders).toHaveLength(1);
		expect(orderCtrl._orders[0].giftCardAmount).toBe(1500);
		// 4000 + 400 + 500 - 0 - 1500 = 3400
		expect(orderCtrl._orders[0].total).toBe(3400);

		// Session should be completed
		expect("session" in result).toBe(true);
		if ("session" in result) {
			expect(result.session.status).toBe("completed");
		}
	});

	it("rejects completion when gift card redemption fails", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const gcCtrl = createMockGiftCardController({ failRedeem: true });
		const orderCtrl = createMockOrderController();

		const session = await ctrl.create(makeSession());
		await ctrl.applyGiftCard(session.id, {
			code: "EXPIRED-CARD",
			giftCardAmount: 1000,
		});

		const result = await simulateCompleteWithGiftCard(ctrl, session.id, {
			giftCardCtrl: gcCtrl,
			orderCtrl,
		});

		// Should fail
		expect("error" in result).toBe(true);
		if ("error" in result) {
			expect(result.error).toContain("Gift card could not be redeemed");
			expect(result.status).toBe(422);
		}

		// No order should be created
		expect(orderCtrl._orders).toHaveLength(0);
	});

	it("adjusts order total when redeemed amount is less than expected", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		// Card only has $10 balance but session expects $15 discount
		const gcCtrl = createMockGiftCardController({ balance: 1000 });
		const orderCtrl = createMockOrderController();

		const session = await ctrl.create(makeSession());
		await ctrl.applyGiftCard(session.id, {
			code: "LOW-BALANCE",
			giftCardAmount: 1500,
		});

		const result = await simulateCompleteWithGiftCard(ctrl, session.id, {
			giftCardCtrl: gcCtrl,
			orderCtrl,
		});

		// Redemption should succeed with capped amount
		expect("session" in result).toBe(true);
		if ("actualGiftCardAmount" in result) {
			expect(result.actualGiftCardAmount).toBe(1000);
		}

		// Order should have adjusted amounts
		expect(orderCtrl._orders).toHaveLength(1);
		expect(orderCtrl._orders[0].giftCardAmount).toBe(1000);
		// 4000 + 400 + 500 - 0 - 1000 = 3900 (not 3400 which would be with 1500)
		expect(orderCtrl._orders[0].total).toBe(3900);
	});

	it("completes normally when no gift card is applied", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const gcCtrl = createMockGiftCardController();
		const orderCtrl = createMockOrderController();

		const session = await ctrl.create(makeSession());

		const result = await simulateCompleteWithGiftCard(ctrl, session.id, {
			giftCardCtrl: gcCtrl,
			orderCtrl,
		});

		// No gift card redemption calls
		expect(gcCtrl._redeemCalls).toHaveLength(0);

		// Order should have original total
		expect(orderCtrl._orders).toHaveLength(1);
		expect(orderCtrl._orders[0].giftCardAmount).toBe(0);
		expect(orderCtrl._orders[0].total).toBe(4900);

		expect("session" in result).toBe(true);
	});

	it("completes without gift card module (no giftCardCtrl)", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const orderCtrl = createMockOrderController();

		const session = await ctrl.create(makeSession());
		await ctrl.applyGiftCard(session.id, {
			code: "GIFT-NO-MODULE",
			giftCardAmount: 1000,
		});

		const result = await simulateCompleteWithGiftCard(ctrl, session.id, {
			giftCardCtrl: undefined,
			orderCtrl,
		});

		// Should complete using the session's stored giftCardAmount
		expect(orderCtrl._orders).toHaveLength(1);
		expect(orderCtrl._orders[0].giftCardAmount).toBe(1000);

		expect("session" in result).toBe(true);
	});

	it("does not redeem gift card when code is empty", async () => {
		const ctrl = createCheckoutController(createMockDataService());
		const gcCtrl = createMockGiftCardController();

		const session = await ctrl.create(makeSession());
		// Session has giftCardAmount=0 and no giftCardCode by default

		await simulateCompleteWithGiftCard(ctrl, session.id, {
			giftCardCtrl: gcCtrl,
		});

		expect(gcCtrl._redeemCalls).toHaveLength(0);
	});
});
