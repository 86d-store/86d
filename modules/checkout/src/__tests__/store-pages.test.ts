import { describe, expect, it } from "vitest";

describe("checkout — store pages registration", () => {
	it("registers /checkout as a store page", async () => {
		const { default: checkout } = await import("../index");
		const mod = checkout({});
		const paths = mod.store?.pages?.map((p) => p.path) ?? [];
		expect(paths).toContain("/checkout");
	});

	it("maps /checkout to the CheckoutForm component", async () => {
		const { default: checkout } = await import("../index");
		const mod = checkout({});
		const checkoutPage = mod.store?.pages?.find((p) => p.path === "/checkout");
		expect(checkoutPage?.component).toBe("CheckoutForm");
	});

	it("registers /checkout/confirmation as a store page", async () => {
		const { default: checkout } = await import("../index");
		const mod = checkout({});
		const paths = mod.store?.pages?.map((p) => p.path) ?? [];
		expect(paths).toContain("/checkout/confirmation");
	});

	it("maps /checkout/confirmation to the OrderConfirmation component", async () => {
		const { default: checkout } = await import("../index");
		const mod = checkout({});
		const confirmPage = mod.store?.pages?.find(
			(p) => p.path === "/checkout/confirmation",
		);
		expect(confirmPage?.component).toBe("OrderConfirmation");
	});
});
