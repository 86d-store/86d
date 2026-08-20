import { describe, expect, it } from "vitest";

describe("Products and Collections authority", () => {
	it("keeps only the namespaced compatibility read and exposes no Collection writer", async () => {
		const { default: products } = await import("../index");
		const mod = products({});
		const pagePaths = mod.admin?.pages?.map((page) => page.path) ?? [];

		expect(pagePaths).not.toContain("/admin/products/collections");
		expect(pagePaths).not.toContain("/admin/collections");
		expect(mod.endpoints?.admin).toHaveProperty(
			"/admin/products/collections/list",
		);
		expect(mod.endpoints?.admin).not.toHaveProperty(
			"/admin/products/collections/create",
		);
		expect(mod.endpoints?.admin).not.toHaveProperty(
			"/admin/collections/create",
		);
	});
});
