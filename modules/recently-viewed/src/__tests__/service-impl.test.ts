import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createRecentlyViewedController } from "../service-impl";

describe("createRecentlyViewedController", () => {
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

	// --- trackView ---

	describe("trackView", () => {
		it("creates a new view for a customer", async () => {
			const view = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);
			expect(view.id).toBeDefined();
			expect(view.customerId).toBe("cust_1");
			expect(view.productId).toBe("prod_1");
			expect(view.productName).toBe("Test Product");
			expect(view.productSlug).toBe("test-product");
			expect(view.viewedAt).toBeInstanceOf(Date);
		});

		it("creates a new view for a session", async () => {
			const view = await controller.trackView(
				viewParams({ sessionId: "sess_abc" }),
			);
			expect(view.sessionId).toBe("sess_abc");
			expect(view.customerId).toBeUndefined();
		});

		it("stores product image and price", async () => {
			const view = await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productImage: "/img/product.jpg",
					productPrice: 2999,
				}),
			);
			expect(view.productImage).toBe("/img/product.jpg");
			expect(view.productPrice).toBe(2999);
		});

		it("deduplicates views within the 5-minute window", async () => {
			const first = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);
			const second = await controller.trackView(
				viewParams({ customerId: "cust_1", productName: "Updated Name" }),
			);

			// Same id means it was updated, not duplicated
			expect(second.id).toBe(first.id);
			expect(second.productName).toBe("Updated Name");
		});

		it("creates separate views for different products", async () => {
			const v1 = await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			const v2 = await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_2",
					productName: "Other Product",
					productSlug: "other-product",
				}),
			);
			expect(v1.id).not.toBe(v2.id);
		});

		it("creates separate views for different customers", async () => {
			const v1 = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);
			const v2 = await controller.trackView(
				viewParams({ customerId: "cust_2" }),
			);
			expect(v1.id).not.toBe(v2.id);
		});

		it("creates separate views for different sessions", async () => {
			const v1 = await controller.trackView(
				viewParams({ sessionId: "sess_1" }),
			);
			const v2 = await controller.trackView(
				viewParams({ sessionId: "sess_2" }),
			);
			expect(v1.id).not.toBe(v2.id);
		});
	});

	// --- getRecentViews ---

	describe("getRecentViews", () => {
		it("returns views for a customer sorted by most recent", async () => {
			// Track first view
			const first = await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_1",
					productName: "First",
					productSlug: "first",
				}),
			);
			// Manually backdate the first view so ordering is deterministic
			const backdated = {
				...first,
				viewedAt: new Date(Date.now() - 60_000),
			};
			await mockData.upsert(
				"productView",
				first.id,
				backdated as Record<string, unknown>,
			);

			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_2",
					productName: "Second",
					productSlug: "second",
				}),
			);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(2);
			// Most recent first
			expect(views[0].productId).toBe("prod_2");
			expect(views[1].productId).toBe("prod_1");
		});

		it("returns views for a session", async () => {
			await controller.trackView(viewParams({ sessionId: "sess_1" }));
			const views = await controller.getRecentViews({
				sessionId: "sess_1",
			});
			expect(views).toHaveLength(1);
		});

		it("returns empty array when no identifier provided", async () => {
			await controller.trackView(viewParams({ customerId: "cust_1" }));
			const views = await controller.getRecentViews({});
			expect(views).toHaveLength(0);
		});

		it("does not mix views across customers", async () => {
			await controller.trackView(viewParams({ customerId: "cust_1" }));
			await controller.trackView(
				viewParams({ customerId: "cust_2", productId: "prod_2" }),
			);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(1);
			expect(views[0].customerId).toBe("cust_1");
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.trackView(
					viewParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `product-${i}`,
					}),
				);
			}
			const views = await controller.getRecentViews({
				customerId: "cust_1",
				take: 3,
			});
			expect(views).toHaveLength(3);
		});
	});

	// --- getPopularProducts ---

	describe("getPopularProducts", () => {
		it("returns products sorted by view count", async () => {
			// Product A viewed 3 times by different customers
			for (let i = 0; i < 3; i++) {
				await controller.trackView(
					viewParams({
						customerId: `cust_${i}`,
						productId: "prod_popular",
						productName: "Popular Product",
						productSlug: "popular",
					}),
				);
			}
			// Product B viewed once
			await controller.trackView(
				viewParams({
					customerId: "cust_0",
					productId: "prod_rare",
					productName: "Rare Product",
					productSlug: "rare",
				}),
			);

			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(2);
			expect(popular[0].productId).toBe("prod_popular");
			expect(popular[0].viewCount).toBe(3);
			expect(popular[1].productId).toBe("prod_rare");
			expect(popular[1].viewCount).toBe(1);
		});

		it("returns empty array when no views exist", async () => {
			const popular = await controller.getPopularProducts();
			expect(popular).toHaveLength(0);
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.trackView(
					viewParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `product-${i}`,
					}),
				);
			}
			const popular = await controller.getPopularProducts({ take: 5 });
			expect(popular).toHaveLength(5);
		});

		it("includes product slug and image", async () => {
			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productImage: "/img/test.jpg",
				}),
			);
			const popular = await controller.getPopularProducts();
			expect(popular[0].productSlug).toBe("test-product");
			expect(popular[0].productImage).toBe("/img/test.jpg");
		});
	});

	// --- clearHistory ---

	describe("clearHistory", () => {
		it("clears all views for a customer", async () => {
			await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const cleared = await controller.clearHistory({
				customerId: "cust_1",
			});
			expect(cleared).toBe(2);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(0);
		});

		it("clears all views for a session", async () => {
			await controller.trackView(viewParams({ sessionId: "sess_1" }));
			const cleared = await controller.clearHistory({
				sessionId: "sess_1",
			});
			expect(cleared).toBe(1);
		});

		it("returns 0 when no views to clear", async () => {
			const cleared = await controller.clearHistory({
				customerId: "nonexistent",
			});
			expect(cleared).toBe(0);
		});

		it("returns 0 when no identifier provided", async () => {
			await controller.trackView(viewParams({ customerId: "cust_1" }));
			const cleared = await controller.clearHistory({});
			expect(cleared).toBe(0);
		});

		it("does not clear other customers' views", async () => {
			await controller.trackView(viewParams({ customerId: "cust_1" }));
			await controller.trackView(
				viewParams({ customerId: "cust_2", productId: "prod_2" }),
			);

			await controller.clearHistory({ customerId: "cust_1" });

			const remaining = await controller.getRecentViews({
				customerId: "cust_2",
			});
			expect(remaining).toHaveLength(1);
		});
	});

	// --- deleteView ---

	describe("deleteView", () => {
		it("deletes a specific view", async () => {
			const view = await controller.trackView(
				viewParams({ customerId: "cust_1" }),
			);
			const deleted = await controller.deleteView(view.id);
			expect(deleted).toBe(true);

			const views = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(views).toHaveLength(0);
		});

		it("returns false for non-existent view", async () => {
			const deleted = await controller.deleteView("nonexistent");
			expect(deleted).toBe(false);
		});
	});

	// --- listAll ---

	describe("listAll", () => {
		it("returns all views across all customers", async () => {
			await controller.trackView(viewParams({ customerId: "cust_1" }));
			await controller.trackView(
				viewParams({
					customerId: "cust_2",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const all = await controller.listAll();
			expect(all).toHaveLength(2);
		});

		it("filters by customerId", async () => {
			await controller.trackView(viewParams({ customerId: "cust_1" }));
			await controller.trackView(
				viewParams({
					customerId: "cust_2",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const filtered = await controller.listAll({
				customerId: "cust_1",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].customerId).toBe("cust_1");
		});

		it("filters by productId", async () => {
			await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const filtered = await controller.listAll({
				productId: "prod_1",
			});
			expect(filtered).toHaveLength(1);
		});

		it("respects pagination (take/skip)", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.trackView(
					viewParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `product-${i}`,
					}),
				);
			}
			const page = await controller.listAll({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// --- countViews ---

	describe("countViews", () => {
		it("counts all views", async () => {
			await controller.trackView(viewParams({ customerId: "cust_1" }));
			await controller.trackView(
				viewParams({
					customerId: "cust_2",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const count = await controller.countViews();
			expect(count).toBe(2);
		});

		it("counts views for a specific customer", async () => {
			await controller.trackView(viewParams({ customerId: "cust_1" }));
			await controller.trackView(
				viewParams({
					customerId: "cust_2",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const count = await controller.countViews({
				customerId: "cust_1",
			});
			expect(count).toBe(1);
		});

		it("returns 0 when no views exist", async () => {
			const count = await controller.countViews();
			expect(count).toBe(0);
		});
	});

	// --- mergeHistory ---

	describe("mergeHistory", () => {
		it("transfers session views to customer", async () => {
			await controller.trackView(
				viewParams({ sessionId: "sess_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productSlug: "p2",
					productName: "Product 2",
				}),
			);

			const merged = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(2);

			// Customer now has the views
			const customerViews = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(customerViews).toHaveLength(2);

			// Session views are gone
			const sessionViews = await controller.getRecentViews({
				sessionId: "sess_1",
			});
			expect(sessionViews).toHaveLength(0);
		});

		it("skips products already viewed by customer", async () => {
			// Customer already viewed prod_1
			await controller.trackView(
				viewParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			// Session has prod_1 and prod_2
			await controller.trackView(
				viewParams({ sessionId: "sess_1", productId: "prod_1" }),
			);
			await controller.trackView(
				viewParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productSlug: "p2",
					productName: "Product 2",
				}),
			);

			const merged = await controller.mergeHistory({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			// Only prod_2 was merged, prod_1 was a duplicate
			expect(merged).toBe(1);

			const customerViews = await controller.getRecentViews({
				customerId: "cust_1",
			});
			expect(customerViews).toHaveLength(2);
		});

		it("returns 0 when session has no views", async () => {
			const merged = await controller.mergeHistory({
				sessionId: "sess_empty",
				customerId: "cust_1",
			});
			expect(merged).toBe(0);
		});
	});
});
