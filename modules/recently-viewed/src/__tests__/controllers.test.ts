import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRecentlyViewedController } from "../service-impl";

describe("createRecentlyViewedController – edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createRecentlyViewedController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createRecentlyViewedController(mockData);
	});

	function viewParams(
		overrides: Partial<Parameters<typeof controller.trackView>[0]> = {},
	) {
		return {
			productId: "prod_1",
			productName: "Test Product",
			productSlug: "test-product",
			...overrides,
		};
	}

	// ── trackView edge cases ─────────────────────────────────────────────

	describe("trackView – edge cases", () => {
		it("tracks a view without customerId or sessionId", async () => {
			const view = await controller.trackView(viewParams());
			expect(view.id).toBeDefined();
			expect(view.customerId).toBeUndefined();
			expect(view.sessionId).toBeUndefined();
		});

		it("creates a new view after the 5-minute dedup window expires", async () => {
			const first = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);

			// Backdate the first view beyond the 5-minute window
			const backdated = {
				...first,
				viewedAt: new Date(Date.now() - 6 * 60 * 1000),
			};
			await mockData.upsert(
				"productView",
				first.id,
				backdated as Record<string, unknown>,
			);

			const second = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);

			// Should be a new view, not a dedup update
			expect(second.id).not.toBe(first.id);
		});

		it("deduplicates rapid successive views of the same product", async () => {
			const v1 = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);
			const v2 = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);
			const v3 = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);

			expect(v1.id).toBe(v2.id);
			expect(v2.id).toBe(v3.id);

			const count = await controller.countViews({ customerId: "cust_1" });
			expect(count).toBe(1);
		});

		it("stores view with no image or price", async () => {
			const view = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);
			expect(view.productImage).toBeUndefined();
			expect(view.productPrice).toBeUndefined();
		});

		it("stores view with price of zero", async () => {
			const view = await controller.trackView(
				viewParams({ customerId: "cust_1", productPrice: 0 }),
			);
			expect(view.productPrice).toBe(0);
		});

		it("updates image and price on dedup hit", async () => {
			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productImage: "/old.jpg",
					productPrice: 100,
				}),
			);

			const updated = await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productImage: "/new.jpg",
					productPrice: 200,
				}),
			);

			expect(updated.productImage).toBe("/new.jpg");
			expect(updated.productPrice).toBe(200);
		});

		it("deduplicates by session when no customerId is set", async () => {
			const first = await controller.trackView(
				viewParams({ sessionId: "sess_1" }),
			);
			const second = await controller.trackView(
				viewParams({ sessionId: "sess_1", productName: "Renamed" }),
			);

			expect(second.id).toBe(first.id);
			expect(second.productName).toBe("Renamed");
		});
	});

	// ── getRecentViews edge cases ────────────────────────────────────────

	describe("getRecentViews – edge cases", () => {
		it("uses skip to paginate through results", async () => {
			for (let i = 0; i < 5; i++) {
				const v = await controller.trackView(
					viewParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `slug-${i}`,
					}),
				);
				// Backdate so ordering is deterministic: prod_0 oldest, prod_4 newest
				const backdated = {
					...v,
					viewedAt: new Date(Date.now() - (5 - i) * 60_000),
				};
				await mockData.upsert(
					"productView",
					v.id,
					backdated as Record<string, unknown>,
				);
			}

			const page = await controller.getRecentViews({
				customerId: "cust_1",
				take: 2,
				skip: 2,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty when skip exceeds total views", async () => {
			await controller.trackView(viewParams({ customerId: "cust_1" }));
			const views = await controller.getRecentViews({
				customerId: "cust_1",
				skip: 10,
			});
			expect(views).toHaveLength(0);
		});

		it("handles large dataset ordering correctly", async () => {
			for (let i = 0; i < 20; i++) {
				const v = await controller.trackView(
					viewParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `slug-${i}`,
					}),
				);
				// Backdate each view with increasing age
				const backdated = {
					...v,
					viewedAt: new Date(Date.now() - (20 - i) * 60_000),
				};
				await mockData.upsert(
					"productView",
					v.id,
					backdated as Record<string, unknown>,
				);
			}

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(20);
			// Most recent (prod_19) should be first
			expect(views[0].productId).toBe("prod_19");
			expect(views[19].productId).toBe("prod_0");
		});

		it("returns empty array for session with no views", async () => {
			const views = await controller.getRecentViews({
				sessionId: "nonexistent",
			});
			expect(views).toHaveLength(0);
		});
	});

	// ── getPopularProducts edge cases ────────────────────────────────────

	describe("getPopularProducts – edge cases", () => {
		it("handles products with equal view counts", async () => {
			// Two products each viewed twice
			for (const cust of ["cust_1", "cust_2"]) {
				await controller.trackView(
					viewParams({
						customerId: cust,
						productId: "prod_a",
						productName: "Product A",
						productSlug: "product-a",
					}),
				);
				await controller.trackView(
					viewParams({
						customerId: cust,
						productId: "prod_b",
						productName: "Product B",
						productSlug: "product-b",
					}),
				);
			}

			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(2);
			expect(popular[0].viewCount).toBe(2);
			expect(popular[1].viewCount).toBe(2);
		});

		it("counts a single product viewed by many customers", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.trackView(
					viewParams({
						customerId: `cust_${i}`,
						productId: "prod_viral",
						productName: "Viral Product",
						productSlug: "viral",
					}),
				);
			}

			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(1);
			expect(popular[0].viewCount).toBe(10);
			expect(popular[0].productName).toBe("Viral Product");
		});

		it("defaults to returning at most 10 products", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.trackView(
					viewParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `slug-${i}`,
					}),
				);
			}

			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(10);
		});

		it("uses latest product snapshot data", async () => {
			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_x",
					productImage: "/old.jpg",
				}),
			);
			await controller.trackView(
				viewParams({
					customerId: "cust_2",
					productId: "prod_x",
					productImage: "/new.jpg",
				}),
			);

			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(1);
			expect(popular[0].viewCount).toBe(2);
		});
	});

	// ── clearHistory edge cases ──────────────────────────────────────────

	describe("clearHistory – edge cases", () => {
		it("returns 0 when clearing already-empty history", async () => {
			const first = await controller.clearHistory({
				customerId: "cust_1",
			});
			expect(first).toBe(0);

			const second = await controller.clearHistory({
				customerId: "cust_1",
			});
			expect(second).toBe(0);
		});

		it("clears history then verifies count is zero", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.trackView(
					viewParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `slug-${i}`,
					}),
				);
			}

			expect(await controller.countViews({ customerId: "cust_1" })).toBe(5);

			const cleared = await controller.clearHistory({
				customerId: "cust_1",
			});
			expect(cleared).toBe(5);
			expect(await controller.countViews({ customerId: "cust_1" })).toBe(0);
		});

		it("clearing one customer does not affect global popular products", async () => {
			await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({ customerId: "cust_2", productId: "prod_1" }),
			);

			await controller.clearHistory({ customerId: "cust_1" });

			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(1);
			expect(popular[0].viewCount).toBe(1);
		});
	});

	// ── mergeHistory edge cases ──────────────────────────────────────────

	describe("mergeHistory – edge cases", () => {
		it("returns 0 when all session products overlap with customer", async () => {
			// Customer already has prod_1 and prod_2
			await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "slug-2",
				}),
			);

			// Session has the same products
			await controller.trackView(
				viewParams({ sessionId: "sess_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productSlug: "slug-2",
				}),
			);

			const merged = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(0);

			// Customer still has exactly 2
			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(2);
		});

		it("merges into a customer that already has many views", async () => {
			// Customer has 5 existing views
			for (let i = 0; i < 5; i++) {
				await controller.trackView(
					viewParams({
						customerId: "cust_1",
						productId: `prod_cust_${i}`,
						productSlug: `cust-slug-${i}`,
					}),
				);
			}

			// Session has 3 new products
			for (let i = 0; i < 3; i++) {
				await controller.trackView(
					viewParams({
						sessionId: "sess_1",
						productId: `prod_sess_${i}`,
						productSlug: `sess-slug-${i}`,
					}),
				);
			}

			const merged = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(3);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(8);
		});

		it("session views are removed after merge", async () => {
			await controller.trackView(
				viewParams({ sessionId: "sess_1", productId: "prod_1" }),
			);

			await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			const sessionViews = await controller.getRecentViews({
				sessionId: "sess_1",
			});
			expect(sessionViews).toHaveLength(0);
		});

		it("merged views have customerId set and sessionId cleared", async () => {
			await controller.trackView(
				viewParams({ sessionId: "sess_1", productId: "prod_1" }),
			);

			await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(1);
			expect(views[0].customerId).toBe("cust_1");
			expect(views[0].sessionId).toBeUndefined();
		});
	});

	// ── countViews edge cases ────────────────────────────────────────────

	describe("countViews – edge cases", () => {
		it("counts with combined customerId and productId filter", async () => {
			await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "slug-2",
				}),
			);
			await controller.trackView(
				viewParams({ customerId: "cust_2", productId: "prod_1" }),
			);

			const count = await controller.countViews({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(count).toBe(1);
		});

		it("counts with only productId filter across all customers", async () => {
			await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({ customerId: "cust_2", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					customerId: "cust_3",
					productId: "prod_2",
					productSlug: "slug-2",
				}),
			);

			const count = await controller.countViews({ productId: "prod_1" });
			expect(count).toBe(2);
		});

		it("returns correct count after deletions", async () => {
			const v1 = await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "slug-2",
				}),
			);

			expect(await controller.countViews({ customerId: "cust_1" })).toBe(2);

			await controller.deleteView(v1.id);

			expect(await controller.countViews({ customerId: "cust_1" })).toBe(1);
		});
	});

	// ── deleteView edge cases ────────────────────────────────────────────

	describe("deleteView – edge cases", () => {
		it("deleting one view does not affect others", async () => {
			const v1 = await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_1",
				}),
			);
			const v2 = await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "slug-2",
				}),
			);

			await controller.deleteView(v1.id);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(1);
			expect(views[0].id).toBe(v2.id);
		});

		it("double-deleting the same view returns false on second attempt", async () => {
			const view = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);

			expect(await controller.deleteView(view.id)).toBe(true);
			expect(await controller.deleteView(view.id)).toBe(false);
		});

		it("delete reduces popular product view count", async () => {
			const views: Awaited<ReturnType<typeof controller.trackView>>[] = [];
			for (let i = 0; i < 3; i++) {
				views.push(
					await controller.trackView(
						viewParams({
							customerId: `cust_${i}`,
							productId: "prod_1",
						}),
					),
				);
			}

			await controller.deleteView(views[0].id);

			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(1);
			expect(popular[0].viewCount).toBe(2);
		});
	});

	// ── listAll edge cases ───────────────────────────────────────────────

	describe("listAll – edge cases", () => {
		it("returns empty array when no views exist", async () => {
			const all = await controller.listAll();
			expect(all).toHaveLength(0);
		});

		it("filters by both customerId and productId", async () => {
			await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "slug-2",
				}),
			);
			await controller.trackView(
				viewParams({ customerId: "cust_2", productId: "prod_1" }),
			);

			const filtered = await controller.listAll({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].customerId).toBe("cust_1");
			expect(filtered[0].productId).toBe("prod_1");
		});

		it("returns results sorted by most recent first", async () => {
			const old = await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_old",
					productSlug: "old",
				}),
			);
			// Backdate the first view
			const backdated = {
				...old,
				viewedAt: new Date(Date.now() - 120_000),
			};
			await mockData.upsert(
				"productView",
				old.id,
				backdated as Record<string, unknown>,
			);

			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_new",
					productSlug: "new",
				}),
			);

			const all = await controller.listAll({ customerId: "cust_1" });
			expect(all[0].productId).toBe("prod_new");
			expect(all[1].productId).toBe("prod_old");
		});
	});
});
