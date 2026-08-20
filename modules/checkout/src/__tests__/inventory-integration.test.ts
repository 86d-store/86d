import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import type { CheckoutLineItem, InventoryCheckController } from "../service";
import { createCheckoutController } from "../service-impl";

// ---------------------------------------------------------------------------
// Mock inventory controller
// ---------------------------------------------------------------------------

/**
 * Creates a mock inventory controller that tracks stock levels and
 * records all calls for assertion. Mirrors the real InventoryController
 * isInStock/reserve/release behaviour.
 */
function createMockInventoryController(
	initialStock: Map<string, { available: number; allowBackorder: boolean }>,
): InventoryCheckController & {
	_stock: Map<string, { available: number; allowBackorder: boolean }>;
	_reservations: Map<string, number>;
	_calls: Array<{
		method: string;
		productId: string;
		quantity?: number | undefined;
	}>;
} {
	const stock = new Map(initialStock);
	const reservations = new Map<string, number>();
	const calls: Array<{
		method: string;
		productId: string;
		quantity?: number | undefined;
	}> = [];

	function stockKey(productId: string, variantId?: string): string {
		return variantId ? `${productId}:${variantId}` : productId;
	}

	return {
		_stock: stock,
		_reservations: reservations,
		_calls: calls,

		async isInStock(params): Promise<boolean> {
			const key = stockKey(params.productId, params.variantId);
			calls.push({
				method: "isInStock",
				productId: params.productId,
				quantity: params.quantity,
			});

			const item = stock.get(key);
			if (!item) return true; // Not tracked = always in stock
			if (item.allowBackorder) return true;

			const reserved = reservations.get(key) ?? 0;
			const available = item.available - reserved;
			return available >= (params.quantity ?? 1);
		},

		async reserve(params): Promise<unknown> {
			const key = stockKey(params.productId, params.variantId);
			calls.push({
				method: "reserve",
				productId: params.productId,
				quantity: params.quantity,
			});

			const current = reservations.get(key) ?? 0;
			reservations.set(key, current + params.quantity);
			return { reserved: true };
		},

		async release(params): Promise<unknown> {
			const key = stockKey(params.productId, params.variantId);
			calls.push({
				method: "release",
				productId: params.productId,
				quantity: params.quantity,
			});

			const current = reservations.get(key) ?? 0;
			reservations.set(key, Math.max(0, current - params.quantity));
			return { released: true };
		},

		async deduct(params): Promise<unknown> {
			const key = stockKey(params.productId, params.variantId);
			calls.push({
				method: "deduct",
				productId: params.productId,
				quantity: params.quantity,
			});

			const item = stock.get(key);
			if (item) {
				item.available = Math.max(0, item.available - params.quantity);
			}
			const reserved = reservations.get(key) ?? 0;
			reservations.set(key, Math.max(0, reserved - params.quantity));
			return { deducted: true };
		},
	};
}

// ---------------------------------------------------------------------------
// Helpers
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

const sampleAddress = {
	firstName: "Jane",
	lastName: "Doe",
	line1: "1 Main St",
	city: "Springfield",
	state: "IL",
	postalCode: "62701",
	country: "US",
};

function makeSession(overrides: Record<string, unknown> = {}) {
	return {
		subtotal: 4000,
		taxAmount: 400,
		shippingAmount: 500,
		total: 4900,
		lineItems: sampleLineItems,
		customerId: "cust-1",
		shippingAddress: sampleAddress,
		...overrides,
	};
}

/**
 * Simulate the confirm-session endpoint logic:
 * check stock → confirm → reserve.
 *
 * This mirrors the actual endpoint handler in confirm-session.ts
 * without needing the better-call HTTP wrapper.
 */
async function simulateConfirmWithInventory(
	checkoutCtrl: ReturnType<typeof createCheckoutController>,
	sessionId: string,
	inventoryCtrl?: InventoryCheckController | undefined,
) {
	// Step 1: Check stock availability
	if (inventoryCtrl) {
		const lineItems = await checkoutCtrl.getLineItems(sessionId);
		const outOfStock: string[] = [];

		for (const item of lineItems) {
			const inStock = await inventoryCtrl.isInStock({
				productId: item.productId,
				variantId: item.variantId,
				quantity: item.quantity,
			});
			if (!inStock) {
				outOfStock.push(item.name);
			}
		}

		if (outOfStock.length > 0) {
			return {
				error: `Insufficient stock for: ${outOfStock.join(", ")}`,
				status: 422,
			};
		}
	}

	// Step 2: Transition to processing
	const result = await checkoutCtrl.confirm(sessionId);
	if ("error" in result) return result;

	// Step 3: Reserve stock
	if (inventoryCtrl) {
		const lineItems = await checkoutCtrl.getLineItems(sessionId);
		for (const item of lineItems) {
			await inventoryCtrl.reserve({
				productId: item.productId,
				variantId: item.variantId,
				quantity: item.quantity,
			});
		}
	}

	return { session: result.session };
}

/**
 * Simulate abandon-session endpoint logic with inventory release.
 */
async function simulateAbandonWithInventory(
	checkoutCtrl: ReturnType<typeof createCheckoutController>,
	sessionId: string,
	wasProcessing: boolean,
	inventoryCtrl?: InventoryCheckController | undefined,
) {
	const session = await checkoutCtrl.abandon(sessionId);
	if (!session) return null;

	// Release reservations if session was in processing state
	if (wasProcessing && inventoryCtrl) {
		const lineItems = await checkoutCtrl.getLineItems(sessionId);
		for (const item of lineItems) {
			await inventoryCtrl.release({
				productId: item.productId,
				variantId: item.variantId,
				quantity: item.quantity,
			});
		}
	}

	return session;
}

/**
 * Simulate the complete-session endpoint logic:
 * complete session → deduct inventory for each line item.
 *
 * This mirrors the actual endpoint handler in complete-session.ts
 * without needing the better-call HTTP wrapper.
 */
async function simulateCompleteWithInventory(
	checkoutCtrl: ReturnType<typeof createCheckoutController>,
	sessionId: string,
	orderId: string,
	inventoryCtrl?: InventoryCheckController | undefined,
) {
	const lineItems = await checkoutCtrl.getLineItems(sessionId);
	const session = await checkoutCtrl.complete(sessionId, orderId);
	if (!session) {
		return { error: "Cannot complete this checkout session", status: 422 };
	}

	// Deduct inventory (convert reservations into actual stock deductions)
	if (inventoryCtrl?.deduct) {
		for (const item of lineItems) {
			await inventoryCtrl.deduct({
				productId: item.productId,
				variantId: item.variantId,
				quantity: item.quantity,
			});
		}
	}

	return { session, orderId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkout → inventory integration", () => {
	describe("confirm with inventory check", () => {
		it("succeeds when all items are in stock", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				expect(result.session.status).toBe("processing");
			}
		});

		it("rejects when a product is out of stock", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 1, allowBackorder: false }], // Only 1 available, need 2
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(422);
				expect(result.error).toContain("Widget");
				expect(result.error).toContain("Insufficient stock");
			}
		});

		it("rejects when a variant is out of stock", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 0, allowBackorder: false }], // Zero stock
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.error).toContain("Gadget S");
			}
		});

		it("lists all out-of-stock items in error message", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 0, allowBackorder: false }],
					["p2:v1", { available: 0, allowBackorder: false }],
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.error).toContain("Widget");
				expect(result.error).toContain("Gadget S");
			}
		});

		it("allows backorder items even when stock is zero", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 0, allowBackorder: true }], // Backorder allowed
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect("session" in result).toBe(true);
		});

		it("treats untracked items as always in stock", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			// No stock entries — items are not tracked
			const inventoryCtrl = createMockInventoryController(new Map());

			const session = await checkoutCtrl.create(makeSession());
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect("session" in result).toBe(true);
		});
	});

	describe("stock reservation", () => {
		it("reserves stock for all line items after confirmation", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			// Verify reserve was called for each line item
			const reserveCalls = inventoryCtrl._calls.filter(
				(c) => c.method === "reserve",
			);
			expect(reserveCalls).toHaveLength(2);
			expect(reserveCalls[0]).toEqual({
				method: "reserve",
				productId: "p1",
				quantity: 2,
			});
			expect(reserveCalls[1]).toEqual({
				method: "reserve",
				productId: "p2",
				quantity: 1,
			});

			// Verify reservation state
			expect(inventoryCtrl._reservations.get("p1")).toBe(2);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(1);
		});

		it("does not reserve stock when confirmation is rejected (out of stock)", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([["p1", { available: 0, allowBackorder: false }]]),
			);

			const session = await checkoutCtrl.create(makeSession());
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			const reserveCalls = inventoryCtrl._calls.filter(
				(c) => c.method === "reserve",
			);
			expect(reserveCalls).toHaveLength(0);
		});

		it("does not reserve stock when session fails validation (no address)", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([["p1", { available: 10, allowBackorder: false }]]),
			);

			// Session without shipping address
			const session = await checkoutCtrl.create(
				makeSession({ shippingAddress: undefined }),
			);
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect("error" in result).toBe(true);
			const reserveCalls = inventoryCtrl._calls.filter(
				(c) => c.method === "reserve",
			);
			expect(reserveCalls).toHaveLength(0);
		});
	});

	describe("inventory release on abandon", () => {
		it("releases reservations when a processing session is abandoned", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			// Confirm session (reserves stock)
			const session = await checkoutCtrl.create(makeSession());
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect(inventoryCtrl._reservations.get("p1")).toBe(2);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(1);

			// Abandon session (should release stock)
			await simulateAbandonWithInventory(
				checkoutCtrl,
				session.id,
				true, // wasProcessing
				inventoryCtrl,
			);

			const releaseCalls = inventoryCtrl._calls.filter(
				(c) => c.method === "release",
			);
			expect(releaseCalls).toHaveLength(2);
			expect(releaseCalls[0]).toEqual({
				method: "release",
				productId: "p1",
				quantity: 2,
			});
			expect(releaseCalls[1]).toEqual({
				method: "release",
				productId: "p2",
				quantity: 1,
			});

			// Reservations should be back to zero
			expect(inventoryCtrl._reservations.get("p1")).toBe(0);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(0);
		});

		it("does not release reservations when a pending session is abandoned", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([["p1", { available: 10, allowBackorder: false }]]),
			);

			// Create session but do NOT confirm (stays pending)
			const session = await checkoutCtrl.create(makeSession());
			await simulateAbandonWithInventory(
				checkoutCtrl,
				session.id,
				false, // wasProcessing = false (was pending)
				inventoryCtrl,
			);

			const releaseCalls = inventoryCtrl._calls.filter(
				(c) => c.method === "release",
			);
			expect(releaseCalls).toHaveLength(0);
		});
	});

	describe("inventory release on expire-stale", () => {
		/**
		 * Simulates the admin expire-stale endpoint logic:
		 * expire sessions → release inventory for processing sessions → cancel payments.
		 */
		async function simulateExpireStaleWithCleanup(
			checkoutCtrl: ReturnType<typeof createCheckoutController>,
			inventoryCtrl?: InventoryCheckController | undefined,
			paymentCtrl?: { cancelIntent(id: string): Promise<unknown> } | undefined,
		) {
			const { expired, processingSessions } = await checkoutCtrl.expireStale();

			let inventoryReleased = 0;
			let paymentsCancelled = 0;

			for (const session of processingSessions) {
				if (inventoryCtrl) {
					const lineItems = await checkoutCtrl.getLineItems(session.id);
					for (const item of lineItems) {
						await inventoryCtrl.release({
							productId: item.productId,
							variantId: item.variantId,
							quantity: item.quantity,
						});
					}
					inventoryReleased++;
				}

				if (
					paymentCtrl &&
					session.paymentIntentId &&
					session.paymentIntentId !== "no_payment_required" &&
					!session.paymentIntentId.startsWith("demo_")
				) {
					await paymentCtrl.cancelIntent(session.paymentIntentId);
					paymentsCancelled++;
				}
			}

			return { expired, inventoryReleased, paymentsCancelled };
		}

		it("releases inventory when a processing session expires", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			// Create and confirm session with short TTL (already expired)
			const session = await checkoutCtrl.create(makeSession({ ttl: -60_000 }));
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			// Verify stock was reserved
			expect(inventoryCtrl._reservations.get("p1")).toBe(2);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(1);

			// Run expire-stale with cleanup
			const result = await simulateExpireStaleWithCleanup(
				checkoutCtrl,
				inventoryCtrl,
			);

			expect(result.expired).toBe(1);
			expect(result.inventoryReleased).toBe(1);

			// Verify stock was released
			const releaseCalls = inventoryCtrl._calls.filter(
				(c) => c.method === "release",
			);
			expect(releaseCalls).toHaveLength(2);
			expect(inventoryCtrl._reservations.get("p1")).toBe(0);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(0);
		});

		it("does not release inventory for expired pending sessions", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([["p1", { available: 10, allowBackorder: false }]]),
			);

			// Create a pending session with expired TTL (never confirmed)
			await checkoutCtrl.create(makeSession({ ttl: -60_000 }));

			const result = await simulateExpireStaleWithCleanup(
				checkoutCtrl,
				inventoryCtrl,
			);

			expect(result.expired).toBe(1);
			expect(result.inventoryReleased).toBe(0);

			const releaseCalls = inventoryCtrl._calls.filter(
				(c) => c.method === "release",
			);
			expect(releaseCalls).toHaveLength(0);
		});

		it("handles mixed pending and processing expired sessions", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			// Expired pending session
			await checkoutCtrl.create(makeSession({ ttl: -60_000 }));

			// Expired processing session
			const processing = await checkoutCtrl.create(
				makeSession({ ttl: -60_000 }),
			);
			await simulateConfirmWithInventory(
				checkoutCtrl,
				processing.id,
				inventoryCtrl,
			);

			// Fresh session (should NOT expire)
			await checkoutCtrl.create(makeSession({ ttl: 60 * 60 * 1000 }));

			const result = await simulateExpireStaleWithCleanup(
				checkoutCtrl,
				inventoryCtrl,
			);

			expect(result.expired).toBe(2);
			expect(result.inventoryReleased).toBe(1);
		});

		it("cancels payment intents for expired processing sessions", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const cancelledIntents: string[] = [];
			const mockPaymentCtrl = {
				async cancelIntent(id: string) {
					cancelledIntents.push(id);
					return { id, status: "cancelled" };
				},
			};

			// Create, confirm, and set payment intent
			const session = await checkoutCtrl.create(makeSession({ ttl: -60_000 }));
			await checkoutCtrl.confirm(session.id);
			await checkoutCtrl.setPaymentIntent(session.id, "pi_test_123", "pending");

			const result = await simulateExpireStaleWithCleanup(
				checkoutCtrl,
				undefined,
				mockPaymentCtrl,
			);

			expect(result.expired).toBe(1);
			expect(result.paymentsCancelled).toBe(1);
			expect(cancelledIntents).toEqual(["pi_test_123"]);
		});

		it("does not cancel demo payment intents", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const cancelledIntents: string[] = [];
			const mockPaymentCtrl = {
				async cancelIntent(id: string) {
					cancelledIntents.push(id);
					return { id, status: "cancelled" };
				},
			};

			const session = await checkoutCtrl.create(makeSession({ ttl: -60_000 }));
			await checkoutCtrl.confirm(session.id);
			await checkoutCtrl.setPaymentIntent(
				session.id,
				"demo_intent_abc",
				"pending",
			);

			const result = await simulateExpireStaleWithCleanup(
				checkoutCtrl,
				undefined,
				mockPaymentCtrl,
			);

			expect(result.expired).toBe(1);
			expect(result.paymentsCancelled).toBe(0);
			expect(cancelledIntents).toHaveLength(0);
		});

		it("does not cancel no_payment_required intents", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const cancelledIntents: string[] = [];
			const mockPaymentCtrl = {
				async cancelIntent(id: string) {
					cancelledIntents.push(id);
					return { id, status: "cancelled" };
				},
			};

			const session = await checkoutCtrl.create(makeSession({ ttl: -60_000 }));
			await checkoutCtrl.confirm(session.id);
			await checkoutCtrl.setPaymentIntent(
				session.id,
				"no_payment_required",
				"pending",
			);

			await simulateExpireStaleWithCleanup(
				checkoutCtrl,
				undefined,
				mockPaymentCtrl,
			);

			expect(cancelledIntents).toHaveLength(0);
		});

		it("releases inventory AND cancels payment for same session", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);
			const cancelledIntents: string[] = [];
			const mockPaymentCtrl = {
				async cancelIntent(id: string) {
					cancelledIntents.push(id);
					return { id, status: "cancelled" };
				},
			};

			const session = await checkoutCtrl.create(makeSession({ ttl: -60_000 }));
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);
			await checkoutCtrl.setPaymentIntent(session.id, "pi_real_456", "pending");

			const result = await simulateExpireStaleWithCleanup(
				checkoutCtrl,
				inventoryCtrl,
				mockPaymentCtrl,
			);

			expect(result.expired).toBe(1);
			expect(result.inventoryReleased).toBe(1);
			expect(result.paymentsCancelled).toBe(1);
			expect(cancelledIntents).toEqual(["pi_real_456"]);
			expect(inventoryCtrl._reservations.get("p1")).toBe(0);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(0);
		});
	});

	describe("inventory deduction on complete", () => {
		it("deducts stock for all line items when completing", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			// Create → confirm (reserves) → complete (deducts)
			const session = await checkoutCtrl.create(makeSession());
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);
			const result = await simulateCompleteWithInventory(
				checkoutCtrl,
				session.id,
				"ORD-001",
				inventoryCtrl,
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				expect(result.session.status).toBe("completed");
			}

			// Verify deduct was called for each line item
			const deductCalls = inventoryCtrl._calls.filter(
				(c) => c.method === "deduct",
			);
			expect(deductCalls).toHaveLength(2);
			expect(deductCalls[0]).toEqual({
				method: "deduct",
				productId: "p1",
				quantity: 2,
			});
			expect(deductCalls[1]).toEqual({
				method: "deduct",
				productId: "p2",
				quantity: 1,
			});
		});

		it("reduces actual stock levels after deduction", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);
			await simulateCompleteWithInventory(
				checkoutCtrl,
				session.id,
				"ORD-002",
				inventoryCtrl,
			);

			// Stock should be reduced by the deducted quantities
			expect(inventoryCtrl._stock.get("p1")?.available).toBe(8); // 10 - 2
			expect(inventoryCtrl._stock.get("p2:v1")?.available).toBe(4); // 5 - 1
		});

		it("clears reservations after deduction", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			// Reservations exist after confirm
			expect(inventoryCtrl._reservations.get("p1")).toBe(2);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(1);

			await simulateCompleteWithInventory(
				checkoutCtrl,
				session.id,
				"ORD-003",
				inventoryCtrl,
			);

			// Reservations should be cleared after deduction
			expect(inventoryCtrl._reservations.get("p1")).toBe(0);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(0);
		});

		it("completes without deduction when no inventory controller", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());

			const session = await checkoutCtrl.create(makeSession());
			await checkoutCtrl.confirm(session.id);
			const result = await simulateCompleteWithInventory(
				checkoutCtrl,
				session.id,
				"ORD-004",
				undefined,
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				expect(result.session.status).toBe("completed");
				expect(result.orderId).toBe("ORD-004");
			}
		});

		it("full lifecycle: reserve → deduct leaves correct stock", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			// Create and confirm two separate sessions
			const session1 = await checkoutCtrl.create(makeSession());
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session1.id,
				inventoryCtrl,
			);

			const session2 = await checkoutCtrl.create(makeSession());
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session2.id,
				inventoryCtrl,
			);

			// Both reserved: p1 has 4 reserved, p2:v1 has 2 reserved
			expect(inventoryCtrl._reservations.get("p1")).toBe(4);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(2);

			// Complete session 1
			await simulateCompleteWithInventory(
				checkoutCtrl,
				session1.id,
				"ORD-A",
				inventoryCtrl,
			);

			// p1: stock 8, reservations 2 (session2 still reserved)
			expect(inventoryCtrl._stock.get("p1")?.available).toBe(8);
			expect(inventoryCtrl._reservations.get("p1")).toBe(2);

			// Complete session 2
			await simulateCompleteWithInventory(
				checkoutCtrl,
				session2.id,
				"ORD-B",
				inventoryCtrl,
			);

			// p1: stock 6, reservations 0
			expect(inventoryCtrl._stock.get("p1")?.available).toBe(6);
			expect(inventoryCtrl._reservations.get("p1")).toBe(0);
			expect(inventoryCtrl._stock.get("p2:v1")?.available).toBe(3);
			expect(inventoryCtrl._reservations.get("p2:v1")).toBe(0);
		});
	});

	describe("without inventory module", () => {
		it("confirm succeeds without inventory controller", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());

			const session = await checkoutCtrl.create(makeSession());
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				undefined, // No inventory module installed
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				expect(result.session.status).toBe("processing");
			}
		});

		it("abandon works without inventory controller", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());

			const session = await checkoutCtrl.create(makeSession());
			await checkoutCtrl.confirm(session.id);

			const abandoned = await simulateAbandonWithInventory(
				checkoutCtrl,
				session.id,
				true,
				undefined, // No inventory module installed
			);

			expect(abandoned?.status).toBe("abandoned");
		});
	});

	describe("edge cases", () => {
		it("handles single item out of stock among many", async () => {
			const items: CheckoutLineItem[] = [
				{ productId: "a", name: "Item A", price: 100, quantity: 1 },
				{ productId: "b", name: "Item B", price: 200, quantity: 3 },
				{ productId: "c", name: "Item C", price: 300, quantity: 1 },
			];

			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["a", { available: 5, allowBackorder: false }],
					["b", { available: 2, allowBackorder: false }], // Only 2, need 3
					["c", { available: 10, allowBackorder: false }],
				]),
			);

			const session = await checkoutCtrl.create({
				...makeSession(),
				lineItems: items,
			});
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.error).toContain("Item B");
				expect(result.error).not.toContain("Item A");
				expect(result.error).not.toContain("Item C");
			}
		});

		it("handles exact stock (quantity equals available)", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 2, allowBackorder: false }], // Exactly 2 needed
					["p2:v1", { available: 1, allowBackorder: false }], // Exactly 1 needed
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			const result = await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			expect("session" in result).toBe(true);
		});

		it("isInStock is called for each line item before any reservation", async () => {
			const checkoutCtrl = createCheckoutController(createMockDataService());
			const inventoryCtrl = createMockInventoryController(
				new Map([
					["p1", { available: 10, allowBackorder: false }],
					["p2:v1", { available: 5, allowBackorder: false }],
				]),
			);

			const session = await checkoutCtrl.create(makeSession());
			await simulateConfirmWithInventory(
				checkoutCtrl,
				session.id,
				inventoryCtrl,
			);

			// All isInStock calls should come before any reserve calls
			const callOrder = inventoryCtrl._calls.map((c) => c.method);
			const firstReserveIdx = callOrder.indexOf("reserve");
			const lastIsInStockIdx = callOrder.lastIndexOf("isInStock");

			expect(firstReserveIdx).toBeGreaterThan(lastIsInStockIdx);
		});
	});
});
