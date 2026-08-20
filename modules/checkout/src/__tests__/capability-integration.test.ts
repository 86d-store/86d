import { describe, expect, it, vi } from "vitest";
import type { CheckoutSession } from "../service";
import { createSession } from "../store/endpoints/create-session";

function checkoutSession(): CheckoutSession {
	const now = new Date("2026-08-13T12:00:00.000Z");
	return {
		id: "session-1",
		revision: 1,
		cartId: "cart-1",
		status: "pending",
		subtotal: 2_500,
		taxAmount: 0,
		shippingAmount: 0,
		discountAmount: 0,
		giftCardAmount: 0,
		storeCreditAmount: 0,
		total: 2_500,
		currency: "USD",
		expiresAt: new Date("2026-08-13T12:30:00.000Z"),
		createdAt: now,
		updatedAt: now,
	};
}

function capabilityInvoker(productAvailable: boolean) {
	return vi.fn(async (definition: { name: string }) => {
		if (definition.name === "cart.snapshot") {
			return {
				ok: true,
				decision: {
					cartId: "cart-1",
					revision: "2026-08-13T12:00:00.000Z",
					items: [{ productId: "product-1", quantity: 2 }],
				},
			};
		}
		if (definition.name === "catalog.product.resolve") {
			if (!productAvailable) {
				return {
					ok: false,
					failure: { code: "CAPABILITY_UNAVAILABLE" },
				};
			}
			return {
				ok: true,
				decision: {
					product: {
						id: "product-1",
						name: "Authoritative Product",
						slug: "authoritative-product",
						status: "active",
						price: 1_250,
						sku: "REAL-SKU",
						images: [],
					},
				},
			};
		}
		return {
			ok: false,
			failure: {
				code: "CAPABILITY_UNAVAILABLE",
				capability: definition.name,
				version: "1.0.0",
			},
		};
	});
}

describe("checkout capability decisions", () => {
	it("creates a session from Cart identity and the Products decision", async () => {
		const create = vi.fn().mockResolvedValue(checkoutSession());
		const result = await createSession({
			body: { cartId: "cart-1" },
			headers: new Headers({ cookie: "cart_guest_id=guest-1" }),
			context: {
				controllers: { checkout: { create } },
				capabilities: { invoke: capabilityInvoker(true) },
				session: null,
			},
		});

		expect(result).toHaveProperty("session");
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				cartId: "cart-1",
				subtotal: 2_500,
				total: 2_500,
				lineItems: [
					expect.objectContaining({
						name: "Authoritative Product",
						price: 1_250,
						quantity: 2,
						sku: "REAL-SKU",
					}),
				],
			}),
		);
	});

	it("fails before persistence when the required Products decision is unavailable", async () => {
		const create = vi.fn();
		const result = await createSession({
			body: { cartId: "cart-1" },
			headers: new Headers({ cookie: "cart_guest_id=guest-1" }),
			context: {
				controllers: { checkout: { create } },
				capabilities: { invoke: capabilityInvoker(false) },
				session: null,
			},
		});

		expect(result).toMatchObject({
			code: "CHECKOUT_PRICING_UNAVAILABLE",
			status: 503,
		});
		expect(create).not.toHaveBeenCalled();
	});
});
