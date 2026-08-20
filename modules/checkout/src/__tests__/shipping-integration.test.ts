import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import type {
	CheckoutAddress,
	CheckoutLineItem,
	ShippingRateController,
} from "../service";
import { createCheckoutController } from "../service-impl";

// ---------------------------------------------------------------------------
// Mock shipping rate controller
// ---------------------------------------------------------------------------

interface CalculateRatesParams {
	country: string;
	orderAmount: number;
	weight?: number | undefined;
}

function createMockShippingController(
	rates: Array<{ id: string; name: string; zoneName: string; price: number }>,
) {
	const calls: CalculateRatesParams[] = [];

	const controller: ShippingRateController & {
		_calls: CalculateRatesParams[];
	} = {
		_calls: calls,
		async calculateRates(params) {
			calls.push(params);
			// Return only rates whose zone matches the country
			// (simplified: return all rates for testing)
			return rates;
		},
	};

	return controller;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleLineItems: CheckoutLineItem[] = [
	{ productId: "p1", name: "Widget", price: 1000, quantity: 2 },
	{
		productId: "p2",
		variantId: "v1",
		name: "Gadget S",
		sku: "GAD-S",
		price: 2000,
		quantity: 1,
	},
];

const sampleAddress: CheckoutAddress = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "1 Main St",
	city: "Springfield",
	state: "IL",
	postalCode: "62701",
	country: "US",
};

const sampleRates = [
	{ id: "rate-std", name: "Standard Shipping", zoneName: "US", price: 599 },
	{ id: "rate-exp", name: "Express Shipping", zoneName: "US", price: 1299 },
	{
		id: "rate-free",
		name: "Free Shipping",
		zoneName: "US Free Zone",
		price: 0,
	},
];

function makeSession(overrides: Record<string, unknown> = {}) {
	return {
		subtotal: 4000,
		taxAmount: 0,
		shippingAmount: 0,
		total: 4000,
		lineItems: sampleLineItems,
		...overrides,
	};
}

/**
 * Simulates what the get-shipping-rates endpoint does: fetches the session,
 * checks for shipping address, calculates order amount from line items,
 * and calls the shipping controller.
 */
async function simulateGetShippingRates(
	ctrl: ReturnType<typeof createCheckoutController>,
	shippingController: ShippingRateController | undefined,
	sessionId: string,
) {
	const session = await ctrl.getById(sessionId);
	if (!session) return { error: "Checkout session not found", status: 404 };

	if (!session.shippingAddress) {
		return { error: "Shipping address is required to get rates", status: 422 };
	}

	if (!shippingController?.calculateRates) {
		return { rates: [] };
	}

	const lineItems = await ctrl.getLineItems(session.id);
	const orderAmount = lineItems.reduce(
		(sum, item) => sum + item.price * item.quantity,
		0,
	);

	const rates = await shippingController.calculateRates({
		country: (session.shippingAddress as { country: string }).country,
		orderAmount,
	});

	return { rates };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkout shipping rate integration", () => {
	describe("get-shipping-rates", () => {
		it("returns rates when shipping address is set", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);
			const shippingCtrl = createMockShippingController(sampleRates);

			const session = await ctrl.create(
				makeSession({ shippingAddress: sampleAddress }),
			);

			const result = await simulateGetShippingRates(
				ctrl,
				shippingCtrl,
				session.id,
			);

			expect("rates" in result).toBe(true);
			if ("rates" in result) {
				expect(result.rates).toHaveLength(3);
				expect(result.rates[0]).toEqual({
					id: "rate-std",
					name: "Standard Shipping",
					zoneName: "US",
					price: 599,
				});
			}
		});

		it("passes correct country and order amount to shipping controller", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);
			const shippingCtrl = createMockShippingController(sampleRates);

			const session = await ctrl.create(
				makeSession({ shippingAddress: sampleAddress }),
			);

			await simulateGetShippingRates(ctrl, shippingCtrl, session.id);

			expect(shippingCtrl._calls).toHaveLength(1);
			expect(shippingCtrl._calls[0]).toEqual({
				country: "US",
				orderAmount: 4000, // p1: 1000*2 + p2: 2000*1
			});
		});

		it("returns error when shipping address is not set", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);
			const shippingCtrl = createMockShippingController(sampleRates);

			const session = await ctrl.create(makeSession());

			const result = await simulateGetShippingRates(
				ctrl,
				shippingCtrl,
				session.id,
			);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(422);
			}
		});

		it("returns error for non-existent session", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);
			const shippingCtrl = createMockShippingController(sampleRates);

			const result = await simulateGetShippingRates(
				ctrl,
				shippingCtrl,
				"nonexistent",
			);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(404);
			}
		});

		it("returns empty rates when shipping controller is not available", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);

			const session = await ctrl.create(
				makeSession({ shippingAddress: sampleAddress }),
			);

			const result = await simulateGetShippingRates(
				ctrl,
				undefined,
				session.id,
			);

			expect("rates" in result).toBe(true);
			if ("rates" in result) {
				expect(result.rates).toHaveLength(0);
			}
		});

		it("calculates order amount from line items correctly", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);
			const shippingCtrl = createMockShippingController([]);

			// Session with different items
			const items: CheckoutLineItem[] = [
				{ productId: "a", name: "A", price: 500, quantity: 3 },
				{ productId: "b", name: "B", price: 1500, quantity: 1 },
			];
			const session = await ctrl.create({
				subtotal: 3000,
				total: 3000,
				lineItems: items,
				shippingAddress: sampleAddress,
			});

			await simulateGetShippingRates(ctrl, shippingCtrl, session.id);

			// 500*3 + 1500*1 = 3000
			expect(shippingCtrl._calls[0].orderAmount).toBe(3000);
		});
	});

	describe("shipping method selection via update", () => {
		it("stores shippingMethodName when selecting a shipping rate", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);

			const session = await ctrl.create(
				makeSession({ shippingAddress: sampleAddress }),
			);

			const updated = await ctrl.update(session.id, {
				shippingAmount: 599,
				shippingMethodName: "Standard Shipping",
			});

			expect(updated).not.toBeNull();
			expect(updated?.shippingAmount).toBe(599);
			expect(updated?.shippingMethodName).toBe("Standard Shipping");
			expect(updated?.total).toBe(4599); // 4000 + 599
		});

		it("recalculates total when shipping method changes", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);

			const session = await ctrl.create(
				makeSession({ shippingAddress: sampleAddress }),
			);

			// Select standard shipping
			await ctrl.update(session.id, {
				shippingAmount: 599,
				shippingMethodName: "Standard Shipping",
			});

			// Change to express shipping
			const updated = await ctrl.update(session.id, {
				shippingAmount: 1299,
				shippingMethodName: "Express Shipping",
			});

			expect(updated?.shippingAmount).toBe(1299);
			expect(updated?.shippingMethodName).toBe("Express Shipping");
			expect(updated?.total).toBe(5299); // 4000 + 1299
		});

		it("allows free shipping selection", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);

			const session = await ctrl.create(
				makeSession({ shippingAddress: sampleAddress }),
			);

			const updated = await ctrl.update(session.id, {
				shippingAmount: 0,
				shippingMethodName: "Free Shipping",
			});

			expect(updated?.shippingAmount).toBe(0);
			expect(updated?.shippingMethodName).toBe("Free Shipping");
			expect(updated?.total).toBe(4000);
		});

		it("preserves shippingMethodName across unrelated updates", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);

			const session = await ctrl.create(
				makeSession({ shippingAddress: sampleAddress }),
			);

			await ctrl.update(session.id, {
				shippingAmount: 599,
				shippingMethodName: "Standard Shipping",
			});

			// Update email — should not clear shipping method
			const updated = await ctrl.update(session.id, {
				guestEmail: "test@example.com",
			});

			expect(updated?.shippingMethodName).toBe("Standard Shipping");
			expect(updated?.shippingAmount).toBe(599);
		});

		it("handles discount with shipping correctly", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);

			const session = await ctrl.create(
				makeSession({ shippingAddress: sampleAddress }),
			);

			await ctrl.update(session.id, {
				shippingAmount: 599,
				shippingMethodName: "Standard Shipping",
			});

			// Apply discount with free shipping
			const updated = await ctrl.applyDiscount(session.id, {
				code: "FREESHIP",
				discountAmount: 0,
				freeShipping: true,
			});

			expect(updated?.shippingAmount).toBe(0);
			// total = 4000 + 0 - 0 = 4000
			expect(updated?.total).toBe(4000);
		});

		it("does not allow updating completed session shipping", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);

			const session = await ctrl.create(makeSession());
			await ctrl.complete(session.id, "order-123");

			const updated = await ctrl.update(session.id, {
				shippingAmount: 599,
				shippingMethodName: "Standard Shipping",
			});

			expect(updated).toBeNull();
		});
	});

	describe("end-to-end shipping flow", () => {
		it("full flow: set address → get rates → select method → confirm", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);
			const shippingCtrl = createMockShippingController(sampleRates);

			// Step 1: Create session
			const session = await ctrl.create(
				makeSession({ guestEmail: "buyer@example.com" }),
			);
			expect(session.shippingAmount).toBe(0);

			// Step 2: Set shipping address
			const withAddress = await ctrl.update(session.id, {
				shippingAddress: sampleAddress,
			});
			expect(withAddress?.shippingAddress).toEqual(sampleAddress);

			// Step 3: Get shipping rates
			const ratesResult = await simulateGetShippingRates(
				ctrl,
				shippingCtrl,
				session.id,
			);
			expect("rates" in ratesResult).toBe(true);
			if (!("rates" in ratesResult)) return;
			expect(ratesResult.rates).toHaveLength(3);

			// Step 4: Select express shipping
			const withMethod = await ctrl.update(session.id, {
				shippingAmount: 1299,
				shippingMethodName: "Express Shipping",
			});
			expect(withMethod?.shippingAmount).toBe(1299);
			expect(withMethod?.shippingMethodName).toBe("Express Shipping");
			expect(withMethod?.total).toBe(5299); // 4000 + 1299

			// Step 5: Confirm session
			const confirmed = await ctrl.confirm(session.id);
			expect("session" in confirmed).toBe(true);
			if ("session" in confirmed) {
				expect(confirmed.session.status).toBe("processing");
				expect(confirmed.session.shippingAmount).toBe(1299);
			}
		});

		it("shipping rates use correct country after address change", async () => {
			const data = createMockDataService();
			const ctrl = createCheckoutController(data);
			const shippingCtrl = createMockShippingController(sampleRates);

			const session = await ctrl.create(makeSession());

			// Set Canadian address
			const caAddress = {
				...sampleAddress,
				country: "CA",
				state: "ON",
				city: "Toronto",
				postalCode: "M5V 2H1",
			};
			await ctrl.update(session.id, { shippingAddress: caAddress });

			await simulateGetShippingRates(ctrl, shippingCtrl, session.id);
			expect(shippingCtrl._calls[0].country).toBe("CA");

			// Change to US address
			await ctrl.update(session.id, { shippingAddress: sampleAddress });
			await simulateGetShippingRates(ctrl, shippingCtrl, session.id);
			expect(shippingCtrl._calls[1].country).toBe("US");
		});
	});
});
