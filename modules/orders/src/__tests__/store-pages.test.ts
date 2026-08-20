import { describe, expect, it } from "vitest";

describe("orders — store pages registration", () => {
	it("registers account order pages", async () => {
		const { default: orders } = await import("../index");
		const mod = orders({});
		const paths = mod.store?.pages?.map((p) => p.path) ?? [];

		expect(paths).toContain("/account/orders");
		expect(paths).toContain("/account/orders/:id");
		expect(paths).toContain("/account/orders/returns");
	});

	it("maps components correctly", async () => {
		const { default: orders } = await import("../index");
		const mod = orders({});
		const pages = mod.store?.pages ?? [];
		const byPath = Object.fromEntries(pages.map((p) => [p.path, p.component]));

		expect(byPath["/account/orders"]).toBe("OrderHistory");
		expect(byPath["/account/orders/:id"]).toBe("OrderDetail");
		expect(byPath["/account/orders/returns"]).toBe("OrderReturns");
	});
});
