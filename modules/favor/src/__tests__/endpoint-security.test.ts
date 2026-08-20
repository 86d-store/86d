import { describe, expect, it } from "vitest";
import { adminEndpoints } from "../admin/endpoints/routes";
import { storeEndpoints } from "../store/endpoints/routes";

describe("favor endpoint security", () => {
	describe("store endpoints", () => {
		it("exposes expected store routes", () => {
			const routes = Object.keys(storeEndpoints);
			expect(routes).toContain("/favor/deliveries");
			expect(routes).toContain("/favor/deliveries/:id");
			expect(routes).toContain("/favor/availability");
		});

		it("store endpoints are defined as functions", () => {
			for (const endpoint of Object.values(storeEndpoints)) {
				expect(typeof endpoint).toBe("function");
			}
		});
	});

	describe("admin endpoints", () => {
		it("exposes expected admin routes", () => {
			const routes = Object.keys(adminEndpoints);
			expect(routes).toContain("/admin/favor/deliveries");
			expect(routes).toContain("/admin/favor/deliveries/:id/status");
			expect(routes).toContain("/admin/favor/service-areas");
			expect(routes).toContain("/admin/favor/service-areas/create");
			expect(routes).toContain("/admin/favor/stats");
		});

		it("admin endpoints are defined as functions", () => {
			for (const endpoint of Object.values(adminEndpoints)) {
				expect(typeof endpoint).toBe("function");
			}
		});
	});
});
