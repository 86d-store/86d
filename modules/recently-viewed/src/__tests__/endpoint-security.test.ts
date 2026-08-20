import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRecentlyViewedController } from "../service-impl";

/**
 * Security regression tests for recently-viewed endpoints.
 *
 * These verify isolation, scoping, and dedup behaviours that
 * the endpoint layer relies on:
 * - Customer / session isolation: one user cannot see another's history
 * - Clear-history scoping: clearing one identity does not affect others
 * - Duplicate-view dedup: repeat views within the window are collapsed
 * - Merge-history safety: session-to-customer transfer is scoped
 * - Delete scoping: individual view deletion does not cascade
 * - Missing-identifier guards: empty params return safe defaults
 */

describe("recently-viewed endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createRecentlyViewedController>;

	function view(
		overrides: Partial<Parameters<typeof controller.trackView>[0]> = {},
	) {
		return {
			productId: "prod_1",
			productName: "Widget",
			productSlug: "widget",
			...overrides,
		};
	}

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createRecentlyViewedController(mockData);
	});

	// ── Customer isolation ──────────────────────────────────────────

	describe("customer isolation", () => {
		it("getRecentViews returns only the requesting customer's views", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ customerId: "cust_2", productId: "p2", productSlug: "p2" }),
			);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(1);
			expect(views[0]?.customerId).toBe("cust_1");
		});

		it("countViews scoped to a customer excludes other customers", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p2", productSlug: "p2" }),
			);
			await controller.trackView(
				view({ customerId: "cust_2", productId: "p3", productSlug: "p3" }),
			);

			expect(await controller.countViews({ customerId: "cust_1" })).toBe(2);
			expect(await controller.countViews({ customerId: "cust_2" })).toBe(1);
		});

		it("session views are invisible to customer queries", async () => {
			await controller.trackView(
				view({ sessionId: "sess_anon", productId: "p1" }),
			);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(0);
		});

		it("customer views are invisible to session queries", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);

			const views = await controller.getRecentViews({
				sessionId: "sess_anon",
			});
			expect(views).toHaveLength(0);
		});
	});

	// ── Clear-history scoping ───────────────────────────────────────

	describe("clear history scoping", () => {
		it("clearing one customer's history preserves another's", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ customerId: "cust_2", productId: "p2", productSlug: "p2" }),
			);

			const cleared = await controller.clearHistory({
				customerId: "cust_1",
			});
			expect(cleared).toBe(1);

			const remaining = await controller.getRecentViews({
				customerId: "cust_2",
			});
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.productId).toBe("p2");
		});

		it("clearing a session's history preserves customer history", async () => {
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p2", productSlug: "p2" }),
			);

			await controller.clearHistory({ sessionId: "sess_1" });

			const custViews = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(custViews).toHaveLength(1);
		});

		it("returns 0 and clears nothing when no identifier is provided", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);

			const cleared = await controller.clearHistory({});
			expect(cleared).toBe(0);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(1);
		});

		it("returns 0 for a non-existent customer", async () => {
			const cleared = await controller.clearHistory({
				customerId: "cust_ghost",
			});
			expect(cleared).toBe(0);
		});
	});

	// ── Duplicate view handling (dedup window) ──────────────────────

	describe("duplicate view handling", () => {
		it("repeat view of the same product within window returns the same id", async () => {
			const first = await controller.trackView(view({ customerId: "cust_1" }));
			const second = await controller.trackView(
				view({ customerId: "cust_1", productName: "Widget v2" }),
			);

			expect(second.id).toBe(first.id);
			expect(second.productName).toBe("Widget v2");
		});

		it("dedup is scoped per-customer — same product by two customers creates two records", async () => {
			const v1 = await controller.trackView(view({ customerId: "cust_1" }));
			const v2 = await controller.trackView(view({ customerId: "cust_2" }));

			expect(v1.id).not.toBe(v2.id);

			const total = await controller.countViews();
			expect(total).toBe(2);
		});

		it("dedup is scoped per-session — same product by two sessions creates two records", async () => {
			const v1 = await controller.trackView(view({ sessionId: "sess_1" }));
			const v2 = await controller.trackView(view({ sessionId: "sess_2" }));

			expect(v1.id).not.toBe(v2.id);
		});

		it("different products from the same customer are not deduped", async () => {
			const v1 = await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			const v2 = await controller.trackView(
				view({
					customerId: "cust_1",
					productId: "p2",
					productSlug: "p2",
					productName: "Gadget",
				}),
			);

			expect(v1.id).not.toBe(v2.id);

			const count = await controller.countViews({
				customerId: "cust_1",
			});
			expect(count).toBe(2);
		});
	});

	// ── Delete scoping ──────────────────────────────────────────────

	describe("delete scoping", () => {
		it("deleteView removes only the targeted view", async () => {
			const v1 = await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					customerId: "cust_1",
					productId: "p2",
					productSlug: "p2",
				}),
			);

			const deleted = await controller.deleteView(v1.id);
			expect(deleted).toBe(true);

			const remaining = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(remaining).toHaveLength(1);
			expect(remaining[0]?.productId).toBe("p2");
		});

		it("deleteView returns false for a non-existent id", async () => {
			expect(await controller.deleteView("no-such-id")).toBe(false);
		});

		it("deleting one customer's view does not affect another customer", async () => {
			const v1 = await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ customerId: "cust_2", productId: "p2", productSlug: "p2" }),
			);

			await controller.deleteView(v1.id);

			const cust2Views = await controller.getRecentViews({
				customerId: "cust_2",
			});
			expect(cust2Views).toHaveLength(1);
		});
	});

	// ── Merge history safety ────────────────────────────────────────

	describe("merge history safety", () => {
		it("merging transfers session views to the target customer only", async () => {
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					sessionId: "sess_1",
					productId: "p2",
					productSlug: "p2",
					productName: "Gadget",
				}),
			);

			const merged = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(2);

			// Views now belong to the customer
			const custViews = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(custViews).toHaveLength(2);

			// Session views are gone
			const sessViews = await controller.getRecentViews({
				sessionId: "sess_1",
			});
			expect(sessViews).toHaveLength(0);
		});

		it("merge does not steal views from a different session", async () => {
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ sessionId: "sess_2", productId: "p2", productSlug: "p2" }),
			);

			await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			// sess_2 view is untouched
			const sess2Views = await controller.getRecentViews({
				sessionId: "sess_2",
			});
			expect(sess2Views).toHaveLength(1);
			expect(sess2Views[0]?.productId).toBe("p2");
		});

		it("merge skips products the customer already viewed", async () => {
			// Customer already has prod_1
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			// Session has p1 (duplicate) and p3 (new)
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					sessionId: "sess_1",
					productId: "p3",
					productSlug: "p3",
					productName: "New Thing",
				}),
			);

			const merged = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(1);

			const custViews = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(custViews).toHaveLength(2);
		});

		it("merge returns 0 when the session has no views", async () => {
			const merged = await controller.mergeHistory({
				sessionId: "sess_empty",
				customerId: "cust_1",
			});
			expect(merged).toBe(0);
		});
	});

	// ── Missing-identifier guards ───────────────────────────────────

	describe("missing-identifier guards", () => {
		it("getRecentViews returns empty array when neither customerId nor sessionId provided", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);

			const views = await controller.getRecentViews({});
			expect(views).toHaveLength(0);
		});

		it("listAll without params returns all views (admin-level)", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ customerId: "cust_2", productId: "p2", productSlug: "p2" }),
			);
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p3", productSlug: "p3" }),
			);

			const all = await controller.listAll();
			expect(all).toHaveLength(3);
		});

		it("countViews without params counts all views (admin-level)", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p2", productSlug: "p2" }),
			);

			expect(await controller.countViews()).toBe(2);
		});

		it("getPopularProducts aggregates across all identities", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ customerId: "cust_2", productId: "p1" }),
			);
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);

			const popular = await controller.getPopularProducts({ take: 5 });
			expect(popular).toHaveLength(1);
			expect(popular[0]?.viewCount).toBe(3);
		});
	});
});
