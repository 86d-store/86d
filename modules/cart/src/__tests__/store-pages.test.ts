import { describe, expect, it } from "vitest";

describe("cart — store pages registration", () => {
	it("registers /cart as a store page", async () => {
		const { default: cart } = await import("../index");
		const mod = cart({});
		const paths = mod.store?.pages?.map((p) => p.path) ?? [];
		expect(paths).toContain("/cart");
	});

	it("maps /cart to the CartPage component", async () => {
		const { default: cart } = await import("../index");
		const mod = cart({});
		const cartPage = mod.store?.pages?.find((p) => p.path === "/cart");
		expect(cartPage?.component).toBe("CartPage");
	});
});
