import { describe, expect, it } from "vitest";
import { adminEndpoints } from "../admin/endpoints/routes";
import { storeEndpoints } from "../store/endpoints/routes";

describe("order-notes endpoint security", () => {
	describe("store endpoints", () => {
		it("exposes expected store routes", () => {
			const routes = Object.keys(storeEndpoints);
			expect(routes).toContain("/orders/:orderId/notes");
			expect(routes).toContain("/orders/:orderId/notes/add");
			expect(routes).toContain("/orders/notes/:noteId/update");
			expect(routes).toContain("/orders/notes/:noteId/delete");
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
			expect(routes).toContain("/admin/order-notes");
			expect(routes).toContain("/admin/order-notes/add");
			expect(routes).toContain("/admin/order-notes/summary");
			expect(routes).toContain("/admin/order-notes/:id/delete");
			expect(routes).toContain("/admin/order-notes/:id/toggle-pin");
		});

		it("admin endpoints are defined as functions", () => {
			for (const endpoint of Object.values(adminEndpoints)) {
				expect(typeof endpoint).toBe("function");
			}
		});
	});
});
