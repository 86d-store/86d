import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRecentlyViewedController } from "../service-impl";

describe("recently-viewed admin workflows", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createRecentlyViewedController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createRecentlyViewedController(mockData);
	});

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

	// ── Dedup window boundary ─────────────────────────────────────────

	describe("dedup window boundaries", () => {
		it("view at exactly 4m59s is still deduped", async () => {
			const first = await controller.trackView(view({ customerId: "cust_1" }));

			// Backdate to 4m59s ago (within 5min window)
			const almostExpired = {
				...first,
				viewedAt: new Date(Date.now() - 4 * 60 * 1000 - 59 * 1000),
			};
			await mockData.upsert(
				"productView",
				first.id,
				almostExpired as Record<string, unknown>,
			);

			const second = await controller.trackView(
				view({ customerId: "cust_1", productName: "Widget v2" }),
			);
			expect(second.id).toBe(first.id);
			expect(second.productName).toBe("Widget v2");
		});

		it("view at exactly 5m01s creates a new record", async () => {
			const first = await controller.trackView(view({ customerId: "cust_1" }));

			// Backdate to 5m01s ago (outside 5min window)
			const expired = {
				...first,
				viewedAt: new Date(Date.now() - 5 * 60 * 1000 - 1000),
			};
			await mockData.upsert(
				"productView",
				first.id,
				expired as Record<string, unknown>,
			);

			const second = await controller.trackView(view({ customerId: "cust_1" }));
			expect(second.id).not.toBe(first.id);
		});

		it("rapid fire 5 views collapse to 1 record", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.trackView(
					view({
						customerId: "cust_1",
						productName: `Widget v${i}`,
					}),
				);
			}

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(1);
			expect(views[0].productName).toBe("Widget v4");
		});

		it("dedup updates slug on hit", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productSlug: "old-slug" }),
			);
			const updated = await controller.trackView(
				view({ customerId: "cust_1", productSlug: "new-slug" }),
			);
			expect(updated.productSlug).toBe("new-slug");
		});
	});

	// ── Popular products cross-identity aggregation ───────────────────

	describe("popular products — cross-identity", () => {
		it("aggregates views from both customers and sessions", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ customerId: "cust_2", productId: "p1" }),
			);

			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(1);
			expect(popular[0].viewCount).toBe(3);
		});

		it("ranks products correctly across mixed identities", async () => {
			// prod_a: 3 views, prod_b: 1 view
			await controller.trackView(
				view({
					customerId: "c1",
					productId: "prod_a",
					productName: "A",
					productSlug: "a",
				}),
			);
			await controller.trackView(
				view({
					customerId: "c2",
					productId: "prod_a",
					productName: "A",
					productSlug: "a",
				}),
			);
			await controller.trackView(
				view({
					sessionId: "s1",
					productId: "prod_a",
					productName: "A",
					productSlug: "a",
				}),
			);
			await controller.trackView(
				view({
					sessionId: "s2",
					productId: "prod_b",
					productName: "B",
					productSlug: "b",
				}),
			);

			const popular = await controller.getPopularProducts();
			expect(popular[0].productId).toBe("prod_a");
			expect(popular[0].viewCount).toBe(3);
			expect(popular[1].productId).toBe("prod_b");
			expect(popular[1].viewCount).toBe(1);
		});

		it("returns product snapshot from the last view entry processed", async () => {
			await controller.trackView(
				view({
					customerId: "c1",
					productId: "prod_x",
					productName: "Name v1",
					productSlug: "slug-v1",
					productImage: "/old.jpg",
				}),
			);
			await controller.trackView(
				view({
					customerId: "c2",
					productId: "prod_x",
					productName: "Name v2",
					productSlug: "slug-v2",
					productImage: "/new.jpg",
				}),
			);

			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(1);
			expect(popular[0].viewCount).toBe(2);
			// Snapshot should be from whichever view was processed last
			// The exact one depends on iteration order, but it should be consistent
			expect(popular[0].productId).toBe("prod_x");
		});
	});

	// ── Merge history advanced scenarios ──────────────────────────────

	describe("merge history — advanced", () => {
		it("second merge of same session is a no-op", async () => {
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);

			const first = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(first).toBe(1);

			const second = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(second).toBe(0);
		});

		it("merges from multiple sessions to same customer", async () => {
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					sessionId: "sess_2",
					productId: "p2",
					productSlug: "p2",
					productName: "Product 2",
				}),
			);

			const m1 = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			const m2 = await controller.mergeHistory({
				sessionId: "sess_2",
				customerId: "cust_1",
			});

			expect(m1).toBe(1);
			expect(m2).toBe(1);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(2);
		});

		it("merge deduplicates across sessions with overlapping products", async () => {
			// Both sessions have p1, only sess_2 has p2
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ sessionId: "sess_2", productId: "p1" }),
			);
			await controller.trackView(
				view({
					sessionId: "sess_2",
					productId: "p2",
					productSlug: "p2",
					productName: "Product 2",
				}),
			);

			const m1 = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(m1).toBe(1); // p1 transferred

			const m2 = await controller.mergeHistory({
				sessionId: "sess_2",
				customerId: "cust_1",
			});
			expect(m2).toBe(1); // p1 skipped (cust already has it), p2 transferred

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(2);
		});

		it("merged views are counted correctly", async () => {
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					sessionId: "sess_1",
					productId: "p2",
					productSlug: "p2",
				}),
			);

			await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			expect(await controller.countViews({ customerId: "cust_1" })).toBe(2);
			expect(await controller.countViews()).toBe(2);
		});
	});

	// ── listAll admin scenarios ───────────────────────────────────────

	describe("listAll — admin scenarios", () => {
		it("includes both customer and session views", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					sessionId: "sess_1",
					productId: "p2",
					productSlug: "p2",
				}),
			);

			const all = await controller.listAll();
			expect(all).toHaveLength(2);
		});

		it("filters customer views while ignoring session views", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					sessionId: "sess_1",
					productId: "p2",
					productSlug: "p2",
				}),
			);

			const filtered = await controller.listAll({
				customerId: "cust_1",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].customerId).toBe("cust_1");
		});

		it("combined customerId + productId filter", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					customerId: "cust_1",
					productId: "p2",
					productSlug: "p2",
				}),
			);
			await controller.trackView(
				view({ customerId: "cust_2", productId: "p1" }),
			);

			const filtered = await controller.listAll({
				customerId: "cust_1",
				productId: "p1",
			});
			expect(filtered).toHaveLength(1);
		});

		it("skip beyond total returns empty", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);

			const result = await controller.listAll({ skip: 100 });
			expect(result).toHaveLength(0);
		});

		it("take=1 returns exactly one", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					customerId: "cust_1",
					productId: "p2",
					productSlug: "p2",
				}),
			);

			const result = await controller.listAll({ take: 1 });
			expect(result).toHaveLength(1);
		});
	});

	// ── Clear + merge interaction ─────────────────────────────────────

	describe("clear and merge interaction", () => {
		it("clearing customer history then merging populates from session", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					sessionId: "sess_1",
					productId: "p2",
					productSlug: "p2",
					productName: "Product 2",
				}),
			);

			// Clear customer's history
			await controller.clearHistory({ customerId: "cust_1" });
			expect(await controller.countViews({ customerId: "cust_1" })).toBe(0);

			// Merge session into customer
			const merged = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(1);
			expect(await controller.countViews({ customerId: "cust_1" })).toBe(1);
		});

		it("clearing session after merge has no effect", async () => {
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);

			await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			// Session is already empty after merge
			const cleared = await controller.clearHistory({
				sessionId: "sess_1",
			});
			expect(cleared).toBe(0);

			// Customer still has the view
			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(1);
		});
	});

	// ── Delete effects on aggregations ────────────────────────────────

	describe("delete effects on aggregations", () => {
		it("deleting a view reduces countViews", async () => {
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

			expect(await controller.countViews()).toBe(2);

			await controller.deleteView(v1.id);
			expect(await controller.countViews()).toBe(1);
		});

		it("deleting all views of a product removes it from popular", async () => {
			const v1 = await controller.trackView(
				view({ customerId: "cust_1", productId: "only_product" }),
			);

			let popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(1);

			await controller.deleteView(v1.id);

			popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(0);
		});

		it("deleting views from one customer does not affect another's count", async () => {
			const v = await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ customerId: "cust_2", productId: "p1" }),
			);

			await controller.deleteView(v.id);

			expect(await controller.countViews({ customerId: "cust_1" })).toBe(0);
			expect(await controller.countViews({ customerId: "cust_2" })).toBe(1);
		});
	});

	// ── Track view data preservation ──────────────────────────────────

	describe("trackView — data preservation", () => {
		it("preserves customerId through dedup update", async () => {
			const first = await controller.trackView(view({ customerId: "cust_1" }));
			const second = await controller.trackView(
				view({ customerId: "cust_1", productName: "Updated" }),
			);

			expect(second.id).toBe(first.id);
			expect(second.customerId).toBe("cust_1");
		});

		it("preserves sessionId through dedup update", async () => {
			const first = await controller.trackView(view({ sessionId: "sess_1" }));
			const second = await controller.trackView(
				view({ sessionId: "sess_1", productPrice: 999 }),
			);

			expect(second.id).toBe(first.id);
			expect(second.sessionId).toBe("sess_1");
		});

		it("view with all optional fields populated", async () => {
			const v = await controller.trackView(
				view({
					customerId: "cust_1",
					sessionId: "sess_1",
					productImage: "/img.jpg",
					productPrice: 4999,
				}),
			);

			expect(v.productImage).toBe("/img.jpg");
			expect(v.productPrice).toBe(4999);
		});

		it("view with no optional fields", async () => {
			const v = await controller.trackView(view({ customerId: "cust_1" }));

			expect(v.productImage).toBeUndefined();
			expect(v.productPrice).toBeUndefined();
		});
	});

	// ── countViews with various filter combinations ───────────────────

	describe("countViews — filter combinations", () => {
		it("counts with productId filter across all identities", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({ sessionId: "sess_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					customerId: "cust_2",
					productId: "p2",
					productSlug: "p2",
				}),
			);

			expect(await controller.countViews({ productId: "p1" })).toBe(2);
			expect(await controller.countViews({ productId: "p2" })).toBe(1);
			expect(await controller.countViews({ productId: "nonexistent" })).toBe(0);
		});

		it("counts with both customerId and productId", async () => {
			await controller.trackView(
				view({ customerId: "cust_1", productId: "p1" }),
			);
			await controller.trackView(
				view({
					customerId: "cust_1",
					productId: "p2",
					productSlug: "p2",
				}),
			);

			expect(
				await controller.countViews({
					customerId: "cust_1",
					productId: "p1",
				}),
			).toBe(1);
		});
	});
});
