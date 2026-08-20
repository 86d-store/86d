import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CheckoutLineItem } from "../service";
import { createCheckoutController } from "../service-impl";

/**
 * Security regression tests for checkout endpoints.
 *
 * Checkout sessions contain PII (email, addresses, payment info).
 * These tests verify:
 * - Customer isolation: sessions scoped by customerId
 * - Status transitions: completed/expired sessions reject modifications
 * - Discount/gift card integrity on terminal sessions
 * - Line item isolation per session
 * - Stale session expiration safety
 */

const VALID_ADDRESS = {
	firstName: "Ada",
	lastName: "Lovelace",
	line1: "123 Main St",
	city: "London",
	state: "ENG",
	postalCode: "SW1A 1AA",
	country: "GB",
};

function makeSession(
	controller: ReturnType<typeof createCheckoutController>,
	overrides: {
		customerId?: string;
		guestEmail?: string;
		subtotal?: number;
		total?: number;
		shippingAddress?: typeof VALID_ADDRESS;
		lineItems?: Array<{
			productId: string;
			name: string;
			price: number;
			quantity: number;
			variantId?: string;
		}>;
		ttl?: number;
	} = {},
) {
	return controller.create({
		cartId: `cart_${crypto.randomUUID().slice(0, 8)}`,
		customerId: overrides.customerId ?? "cust_default",
		guestEmail: overrides.guestEmail,
		subtotal: overrides.subtotal ?? 5000,
		total: overrides.total ?? 5000,
		shippingAddress: overrides.shippingAddress,
		lineItems: overrides.lineItems ?? [
			{ productId: "prod_1", name: "Widget", price: 2500, quantity: 2 },
		],
		ttl: overrides.ttl,
	});
}

describe("checkout endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createCheckoutController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createCheckoutController(mockData);
	});

	// -- Customer Isolation ------------------------------------------------

	describe("customer isolation", () => {
		it("sessions created for different customers have distinct IDs and ownership", async () => {
			const s1 = await makeSession(controller, {
				customerId: "cust_alice",
			});
			const s2 = await makeSession(controller, {
				customerId: "cust_bob",
			});

			expect(s1.id).not.toBe(s2.id);
			expect(s1.customerId).toBe("cust_alice");
			expect(s2.customerId).toBe("cust_bob");
		});

		it("getById exposes customerId so callers can verify ownership", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_alice",
			});

			const fetched = await controller.getById(session.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.customerId).toBe("cust_alice");
		});

		it("listSessions search scopes results by customerId text match", async () => {
			await makeSession(controller, { customerId: "cust_alice" });
			await makeSession(controller, { customerId: "cust_bob" });
			await makeSession(controller, { customerId: "cust_alice" });

			const result = await controller.listSessions({
				search: "cust_alice",
			});
			expect(result.total).toBe(2);
			for (const s of result.sessions) {
				expect(s.customerId).toBe("cust_alice");
			}
		});
	});

	// -- Status Transitions ------------------------------------------------

	describe("status-based access control", () => {
		it("completed session rejects update attempts", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
				shippingAddress: VALID_ADDRESS,
			});
			await controller.complete(session.id, "order_123");

			const result = await controller.update(session.id, {
				guestEmail: "hacker@evil.com",
			});
			expect(result).toBeNull();

			const fetched = await controller.getById(session.id);
			expect(fetched?.status).toBe("completed");
			expect(fetched?.guestEmail).toBeUndefined();
		});

		it("expired session rejects update attempts", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
				ttl: 1,
			});
			// Force expiry by manipulating the stored record
			const stored = await controller.getById(session.id);
			if (stored) {
				const expired = {
					...stored,
					status: "expired" as const,
					expiresAt: new Date(Date.now() - 60_000),
				};
				await mockData.upsert(
					"checkoutSession",
					session.id,
					expired as Record<string, unknown>,
				);
			}

			const result = await controller.update(session.id, {
				guestEmail: "hacker@evil.com",
			});
			expect(result).toBeNull();
		});

		it("confirm rejects already-completed sessions with descriptive error", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
				shippingAddress: VALID_ADDRESS,
			});
			await controller.complete(session.id, "order_1");

			const result = await controller.confirm(session.id);
			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(422);
				expect(result.error).toContain("completed");
			}
		});

		it("confirm on non-existent session returns 404 error", async () => {
			const result = await controller.confirm("nonexistent_id");
			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(404);
			}
		});

		it("completed session cannot be abandoned", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
				shippingAddress: VALID_ADDRESS,
			});
			await controller.complete(session.id, "order_1");

			const result = await controller.abandon(session.id);
			expect(result).toBeNull();

			const fetched = await controller.getById(session.id);
			expect(fetched?.status).toBe("completed");
		});

		it("completed session rejects setPaymentIntent", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
				shippingAddress: VALID_ADDRESS,
			});
			await controller.complete(session.id, "order_1");

			const result = await controller.setPaymentIntent(
				session.id,
				"pi_malicious",
				"succeeded",
			);
			expect(result).toBeNull();
		});
	});

	// -- Discount Integrity ------------------------------------------------

	describe("discount and gift card integrity", () => {
		it("applying discount to completed session returns null", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
				shippingAddress: VALID_ADDRESS,
			});
			await controller.complete(session.id, "order_1");

			const result = await controller.applyDiscount(session.id, {
				code: "STEAL50",
				discountAmount: 5000,
				freeShipping: false,
			});
			expect(result).toBeNull();

			const fetched = await controller.getById(session.id);
			expect(fetched?.discountCode).toBeUndefined();
			expect(fetched?.discountAmount).toBe(0);
		});

		it("applying gift card to completed session returns null", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
				shippingAddress: VALID_ADDRESS,
			});
			await controller.complete(session.id, "order_1");

			const result = await controller.applyGiftCard(session.id, {
				code: "GC_STOLEN",
				giftCardAmount: 9999,
			});
			expect(result).toBeNull();

			const fetched = await controller.getById(session.id);
			expect(fetched?.giftCardCode).toBeUndefined();
		});

		it("removeDiscount on completed session returns null", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
			});
			await controller.applyDiscount(session.id, {
				code: "SAVE10",
				discountAmount: 1000,
				freeShipping: false,
			});
			await controller.complete(session.id, "order_1");

			const result = await controller.removeDiscount(session.id);
			expect(result).toBeNull();

			const fetched = await controller.getById(session.id);
			expect(fetched?.discountCode).toBe("SAVE10");
		});

		it("removeGiftCard on completed session returns null", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
			});
			await controller.applyGiftCard(session.id, {
				code: "GC_VALID",
				giftCardAmount: 2000,
			});
			await controller.complete(session.id, "order_1");

			const result = await controller.removeGiftCard(session.id);
			expect(result).toBeNull();

			const fetched = await controller.getById(session.id);
			expect(fetched?.giftCardCode).toBe("GC_VALID");
		});
	});

	// -- Line Item Isolation -----------------------------------------------

	describe("line item isolation", () => {
		it("line items are scoped to their session and do not leak", async () => {
			const s1 = await makeSession(controller, {
				customerId: "cust_1",
				lineItems: [
					{ productId: "prod_a", name: "Alpha", price: 1000, quantity: 1 },
				],
			});
			const s2 = await makeSession(controller, {
				customerId: "cust_2",
				lineItems: [
					{ productId: "prod_b", name: "Beta", price: 2000, quantity: 3 },
				],
			});

			const items1 = await controller.getLineItems(s1.id);
			const items2 = await controller.getLineItems(s2.id);

			expect(items1).toHaveLength(1);
			expect(items1[0].productId).toBe("prod_a");
			expect(items2).toHaveLength(1);
			expect(items2[0].productId).toBe("prod_b");
		});

		it("getLineItems for non-existent session returns empty array", async () => {
			const items = await controller.getLineItems("nonexistent_session");
			expect(items).toHaveLength(0);
		});
	});

	// -- Server-Side Price Validation --------------------------------------

	describe("server-side price validation (create-session)", () => {
		/**
		 * Simulates the price validation logic from create-session.ts.
		 * Uses a mock _dataRegistry to look up real product prices.
		 */
		function simulateCreateSessionWithPriceValidation(
			ctrl: ReturnType<typeof createCheckoutController>,
			lineItems: CheckoutLineItem[],
			productsDataService: ReturnType<typeof createMockDataService> | undefined,
			opts: {
				customerId?: string;
				taxAmount?: number;
				shippingAmount?: number;
			} = {},
		) {
			return (async () => {
				if (lineItems.length === 0) {
					return { error: "Cart is empty", status: 400 };
				}

				// Mirror the endpoint's price validation logic
				const items = lineItems.map((i) => ({ ...i })); // shallow clone
				if (productsDataService) {
					for (const item of items) {
						let trustedPrice: number | undefined;
						if (item.variantId) {
							const variant = (await productsDataService.get(
								"productVariant",
								item.variantId,
							)) as { price: number } | null;
							if (variant) trustedPrice = variant.price;
						}
						if (trustedPrice === undefined) {
							const product = (await productsDataService.get(
								"product",
								item.productId,
							)) as { price: number } | null;
							if (!product) {
								return {
									error: `Product not found: ${item.name}`,
									status: 400,
								};
							}
							trustedPrice = product.price;
						}
						item.price = trustedPrice;
					}
				}

				const subtotal = items.reduce(
					(sum, item) => sum + item.price * item.quantity,
					0,
				);
				const taxAmount = opts.taxAmount ?? 0;
				const shippingAmount = opts.shippingAmount ?? 0;
				const total = subtotal + taxAmount + shippingAmount;

				const session = await ctrl.create({
					customerId: opts.customerId ?? "cust_test",
					subtotal,
					total,
					lineItems: items,
					shippingAddress: VALID_ADDRESS,
				});

				return { session };
			})();
		}

		it("overrides client price with server-side product price", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "prod_1", {
				id: "prod_1",
				price: 2500,
				status: "active",
			});

			const result = await simulateCreateSessionWithPriceValidation(
				controller,
				[{ productId: "prod_1", name: "Widget", price: 100, quantity: 2 }], // client sends 100 (manipulated)
				productsData,
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				// Total should be based on real price (2500 * 2 = 5000), not client price (100 * 2 = 200)
				expect(result.session.subtotal).toBe(5000);
				expect(result.session.total).toBe(5000);
			}
		});

		it("uses variant price when variant exists", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "prod_1", {
				id: "prod_1",
				price: 2000,
				status: "active",
			});
			await productsData.upsert("productVariant", "var_1", {
				id: "var_1",
				price: 3000,
			});

			const result = await simulateCreateSessionWithPriceValidation(
				controller,
				[
					{
						productId: "prod_1",
						variantId: "var_1",
						name: "Widget Large",
						price: 100,
						quantity: 1,
					},
				],
				productsData,
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				// Should use variant price (3000), not product price (2000) or client price (100)
				expect(result.session.subtotal).toBe(3000);
				expect(result.session.total).toBe(3000);
			}
		});

		it("falls back to product price when variant not found", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "prod_1", {
				id: "prod_1",
				price: 2000,
				status: "active",
			});

			const result = await simulateCreateSessionWithPriceValidation(
				controller,
				[
					{
						productId: "prod_1",
						variantId: "nonexistent_variant",
						name: "Widget",
						price: 100,
						quantity: 1,
					},
				],
				productsData,
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				expect(result.session.subtotal).toBe(2000);
			}
		});

		it("rejects when product does not exist", async () => {
			const productsData = createMockDataService();
			// No products seeded

			const result = await simulateCreateSessionWithPriceValidation(
				controller,
				[
					{
						productId: "prod_missing",
						name: "Ghost Item",
						price: 100,
						quantity: 1,
					},
				],
				productsData,
			);

			expect("error" in result).toBe(true);
			if ("error" in result) {
				expect(result.status).toBe(400);
				expect(result.error).toContain("Ghost Item");
			}
		});

		it("validates prices for multiple line items independently", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "prod_a", {
				id: "prod_a",
				price: 1000,
				status: "active",
			});
			await productsData.upsert("product", "prod_b", {
				id: "prod_b",
				price: 3000,
				status: "active",
			});

			const result = await simulateCreateSessionWithPriceValidation(
				controller,
				[
					{ productId: "prod_a", name: "A", price: 1, quantity: 2 }, // manipulated to 1
					{ productId: "prod_b", name: "B", price: 1, quantity: 1 }, // manipulated to 1
				],
				productsData,
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				// Should be (1000*2) + (3000*1) = 5000, not (1*2) + (1*1) = 3
				expect(result.session.subtotal).toBe(5000);
				expect(result.session.total).toBe(5000);
			}
		});

		it("recalculates total including tax and shipping after price correction", async () => {
			const productsData = createMockDataService();
			await productsData.upsert("product", "prod_1", {
				id: "prod_1",
				price: 2000,
				status: "active",
			});

			const result = await simulateCreateSessionWithPriceValidation(
				controller,
				[{ productId: "prod_1", name: "Widget", price: 1, quantity: 1 }],
				productsData,
				{ taxAmount: 200, shippingAmount: 500 },
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				// subtotal=2000, tax=200, shipping=500 → total=2700
				expect(result.session.subtotal).toBe(2000);
				expect(result.session.total).toBe(2700);
			}
		});

		it("passes through prices unchanged when no products registry", async () => {
			// No _dataRegistry — mirrors stores that don't have the products module
			const result = await simulateCreateSessionWithPriceValidation(
				controller,
				[{ productId: "prod_1", name: "Widget", price: 999, quantity: 3 }],
				undefined, // no products data service
			);

			expect("session" in result).toBe(true);
			if ("session" in result) {
				// Client price accepted as-is
				expect(result.session.subtotal).toBe(2997);
				expect(result.session.total).toBe(2997);
			}
		});
	});

	// -- Session Expiry Safety ---------------------------------------------

	describe("session expiry safety", () => {
		it("expireStale expires only pending/processing sessions past TTL", async () => {
			// Create a session with very short TTL and force its expiresAt to the past
			const pending = await makeSession(controller, {
				customerId: "cust_1",
				ttl: 1,
			});
			const stored = await controller.getById(pending.id);
			if (stored) {
				const pastExpiry = {
					...stored,
					expiresAt: new Date(Date.now() - 60_000),
				};
				await mockData.upsert(
					"checkoutSession",
					pending.id,
					pastExpiry as Record<string, unknown>,
				);
			}

			const result = await controller.expireStale();
			expect(result.expired).toBeGreaterThanOrEqual(1);

			const fetched = await controller.getById(pending.id);
			expect(fetched?.status).toBe("expired");
		});

		it("expireStale does not expire completed sessions", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
				shippingAddress: VALID_ADDRESS,
			});
			await controller.complete(session.id, "order_done");

			// Force expiresAt into the past on the completed session
			const stored = await controller.getById(session.id);
			if (stored) {
				const pastExpiry = {
					...stored,
					expiresAt: new Date(Date.now() - 60_000),
				};
				await mockData.upsert(
					"checkoutSession",
					session.id,
					pastExpiry as Record<string, unknown>,
				);
			}

			await controller.expireStale();
			// The completed session should NOT be touched
			const fetched = await controller.getById(session.id);
			expect(fetched?.status).toBe("completed");
			expect(fetched?.orderId).toBe("order_done");
		});

		it("expireStale reports processing sessions for inventory cleanup", async () => {
			const session = await makeSession(controller, {
				customerId: "cust_1",
				shippingAddress: VALID_ADDRESS,
			});

			// Force session into processing status with expired TTL
			const stored = await controller.getById(session.id);
			if (stored) {
				const processing = {
					...stored,
					status: "processing" as const,
					expiresAt: new Date(Date.now() - 60_000),
				};
				await mockData.upsert(
					"checkoutSession",
					session.id,
					processing as Record<string, unknown>,
				);
			}

			const result = await controller.expireStale();
			expect(result.expired).toBeGreaterThanOrEqual(1);
			expect(result.processingSessions.length).toBeGreaterThanOrEqual(1);
			expect(result.processingSessions[0].id).toBe(session.id);
		});
	});
});
