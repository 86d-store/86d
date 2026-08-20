import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { adminEndpoints } from "../admin/endpoints/routes";

describe("wish admin hook contract", () => {
	it("binds all required endpoints in the admin component", () => {
		const source = readFileSync(
			join(import.meta.dirname, "../admin/components/wish-admin.tsx"),
			"utf-8",
		);
		const requiredEndpoints = [
			"/admin/wish/stats",
			"/admin/wish/products",
			"/admin/wish/orders",
			"/admin/wish/orders/pending",
			"/admin/wish/products/:id/disable",
			"/admin/wish/orders/:id/ship",
		];
		for (const endpoint of requiredEndpoints) {
			expect(source).toContain(`"${endpoint}"`);
			expect(
				adminEndpoints[endpoint as keyof typeof adminEndpoints],
			).toBeDefined();
		}
	});
});
