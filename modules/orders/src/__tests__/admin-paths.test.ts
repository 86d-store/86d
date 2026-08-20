import { describe, expect, it } from "vitest";

describe("orders — legacy admin path namespacing", () => {
	it("moves returns admin routes under /admin/orders/returns", async () => {
		const { default: orders } = await import("../index");
		const mod = orders({});
		const pagePaths = mod.admin?.pages?.map((page) => page.path) ?? [];

		expect(pagePaths).toContain("/admin/orders/returns");
		expect(pagePaths).not.toContain("/admin/returns");
		expect(mod.endpoints?.admin).toHaveProperty("/admin/orders/returns");
		expect(mod.endpoints?.admin).toHaveProperty(
			"/admin/orders/returns/:id/update",
		);
		expect(mod.endpoints?.admin).not.toHaveProperty("/admin/returns");
	});
});
