import { describe, expect, it, vi } from "vitest";
import { canAccessOrderFulfillment } from "../store/endpoints/order-access";

describe("Fulfillment store read gating", () => {
	it("authorizes an authenticated Store Customer through orders.customer.authorize", async () => {
		const invoke = vi.fn(async (definition: { name: string }) => {
			if (definition.name === "customers.identity.resolve") {
				return {
					ok: true,
					decision: { customerId: "store-customer-1" },
				};
			}
			if (definition.name === "orders.customer.authorize") {
				return { ok: true, decision: { authorized: true } };
			}
			return { ok: false, failure: { code: "CAPABILITY_UNAVAILABLE" } };
		});

		await expect(
			canAccessOrderFulfillment(
				{
					session: {
						user: {
							id: "auth-subject-1",
							email: "ada@example.com",
							emailVerified: true,
							name: "Ada Lovelace",
						},
						session: { id: "session-1" },
					} as never,
					capabilities: { invoke } as never,
				},
				"order-1",
				null,
			),
		).resolves.toBe(true);
		expect(invoke).toHaveBeenCalledWith(
			expect.objectContaining({ name: "orders.customer.authorize" }),
			{ orderId: "order-1", customerId: "store-customer-1" },
		);
	});

	it("authorizes a guest through matching checkout proof cookies", async () => {
		const invoke = vi.fn(async (definition: { name: string }) => {
			if (definition.name === "orders.guest.authorize") {
				return { ok: true, decision: { authorized: true } };
			}
			return { ok: false, failure: { code: "CAPABILITY_UNAVAILABLE" } };
		});

		await expect(
			canAccessOrderFulfillment(
				{ session: null, capabilities: { invoke } as never },
				"order-1",
				"checkout_guest_checkout-1=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			),
		).resolves.toBe(true);
	});

	it("denies an unauthenticated read without guest proof", async () => {
		const invoke = vi.fn();
		await expect(
			canAccessOrderFulfillment(
				{ session: null, capabilities: { invoke } as never },
				"order-1",
				null,
			),
		).resolves.toBe(false);
		expect(invoke).not.toHaveBeenCalled();
	});
});
