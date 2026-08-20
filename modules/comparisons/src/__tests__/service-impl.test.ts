import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createComparisonController } from "../service-impl";

describe("createComparisonController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createComparisonController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createComparisonController(mockData);
	});

	function itemParams(
		overrides: Partial<Parameters<typeof controller.addProduct>[0]> = {},
	) {
		return {
			productId: "prod_1",
			productName: "Test Product",
			productSlug: "test-product",
			...overrides,
		};
	}

	// --- addProduct ---

	describe("addProduct", () => {
		it("adds a product to comparison for a customer", async () => {
			const item = await controller.addProduct(
				itemParams({ customerId: "cust_1" }),
			);
			expect(item.id).toBeDefined();
			expect(item.customerId).toBe("cust_1");
			expect(item.productId).toBe("prod_1");
			expect(item.productName).toBe("Test Product");
			expect(item.productSlug).toBe("test-product");
			expect(item.addedAt).toBeInstanceOf(Date);
		});

		it("adds a product to comparison for a session", async () => {
			const item = await controller.addProduct(
				itemParams({ sessionId: "sess_abc" }),
			);
			expect(item.sessionId).toBe("sess_abc");
			expect(item.customerId).toBeUndefined();
		});

		it("stores product image, price, and category", async () => {
			const item = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productImage: "/img/product.jpg",
					productPrice: 2999,
					productCategory: "Electronics",
				}),
			);
			expect(item.productImage).toBe("/img/product.jpg");
			expect(item.productPrice).toBe(2999);
			expect(item.productCategory).toBe("Electronics");
		});

		it("stores product attributes", async () => {
			const attrs = { Color: "Red", Size: "Large", Weight: "2kg" };
			const item = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					attributes: attrs,
				}),
			);
			expect(item.attributes).toEqual(attrs);
		});

		it("updates existing product instead of duplicating", async () => {
			const first = await controller.addProduct(
				itemParams({ customerId: "cust_1" }),
			);
			const second = await controller.addProduct(
				itemParams({ customerId: "cust_1", productName: "Updated Name" }),
			);

			expect(second.id).toBe(first.id);
			expect(second.productName).toBe("Updated Name");
		});

		it("allows different products for the same customer", async () => {
			const item1 = await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			const item2 = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_2",
					productName: "Product 2",
					productSlug: "product-2",
				}),
			);
			expect(item1.id).not.toBe(item2.id);
		});

		it("enforces max products limit", async () => {
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `product-${i}`,
					}),
				);
			}

			await expect(
				controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: "prod_extra",
						productSlug: "product-extra",
					}),
				),
			).rejects.toThrow("Comparison limit reached");
		});

		it("respects custom max products limit", async () => {
			for (let i = 0; i < 2; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `product-${i}`,
						maxProducts: 2,
					}),
				);
			}

			await expect(
				controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: "prod_extra",
						productSlug: "product-extra",
						maxProducts: 2,
					}),
				),
			).rejects.toThrow("Comparison limit reached");
		});

		it("allows adding when updating existing product even at limit", async () => {
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `product-${i}`,
					}),
				);
			}

			// Should succeed because prod_0 already exists — it's an update
			const updated = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_0",
					productName: "Updated",
				}),
			);
			expect(updated.productName).toBe("Updated");
		});

		it("throws when no identifier provided", async () => {
			await expect(controller.addProduct(itemParams())).rejects.toThrow(
				"Either customerId or sessionId is required",
			);
		});

		it("separates comparisons for different customers", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({ customerId: "cust_2", productId: "prod_1" }),
			);

			const c1 = await controller.getComparison({ customerId: "cust_1" });
			const c2 = await controller.getComparison({ customerId: "cust_2" });
			expect(c1).toHaveLength(1);
			expect(c2).toHaveLength(1);
		});
	});

	// --- removeProduct ---

	describe("removeProduct", () => {
		it("removes a product from comparison", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const removed = await controller.removeProduct({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(removed).toBe(true);

			const items = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(1);
			expect(items[0].productId).toBe("prod_2");
		});

		it("returns false when product not in comparison", async () => {
			const removed = await controller.removeProduct({
				customerId: "cust_1",
				productId: "nonexistent",
			});
			expect(removed).toBe(false);
		});

		it("returns false when no identifier provided", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			const removed = await controller.removeProduct({
				productId: "prod_1",
			});
			expect(removed).toBe(false);
		});

		it("removes by session", async () => {
			await controller.addProduct(itemParams({ sessionId: "sess_1" }));
			const removed = await controller.removeProduct({
				sessionId: "sess_1",
				productId: "prod_1",
			});
			expect(removed).toBe(true);

			const items = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(items).toHaveLength(0);
		});
	});

	// --- getComparison ---

	describe("getComparison", () => {
		it("returns items sorted by addedAt ascending (stable order)", async () => {
			const first = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_1",
					productName: "First",
					productSlug: "first",
				}),
			);
			// Manually backdate the first item
			const backdated = {
				...first,
				addedAt: new Date(Date.now() - 60_000),
			};
			await mockData.upsert(
				"comparisonItem",
				first.id,
				backdated as Record<string, unknown>,
			);

			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_2",
					productName: "Second",
					productSlug: "second",
				}),
			);

			const items = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(2);
			// Oldest first (stable comparison order)
			expect(items[0].productId).toBe("prod_1");
			expect(items[1].productId).toBe("prod_2");
		});

		it("returns items for a session", async () => {
			await controller.addProduct(itemParams({ sessionId: "sess_1" }));
			const items = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(items).toHaveLength(1);
		});

		it("returns empty array when no identifier provided", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			const items = await controller.getComparison({});
			expect(items).toHaveLength(0);
		});

		it("does not mix items across customers", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			await controller.addProduct(
				itemParams({ customerId: "cust_2", productId: "prod_2" }),
			);

			const items = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(1);
			expect(items[0].customerId).toBe("cust_1");
		});
	});

	// --- clearComparison ---

	describe("clearComparison", () => {
		it("clears all items for a customer", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const cleared = await controller.clearComparison({
				customerId: "cust_1",
			});
			expect(cleared).toBe(2);

			const items = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(0);
		});

		it("clears all items for a session", async () => {
			await controller.addProduct(itemParams({ sessionId: "sess_1" }));
			const cleared = await controller.clearComparison({
				sessionId: "sess_1",
			});
			expect(cleared).toBe(1);
		});

		it("returns 0 when no items to clear", async () => {
			const cleared = await controller.clearComparison({
				customerId: "nonexistent",
			});
			expect(cleared).toBe(0);
		});

		it("returns 0 when no identifier provided", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			const cleared = await controller.clearComparison({});
			expect(cleared).toBe(0);
		});

		it("does not clear other customers' items", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			await controller.addProduct(
				itemParams({ customerId: "cust_2", productId: "prod_2" }),
			);

			await controller.clearComparison({ customerId: "cust_1" });

			const remaining = await controller.getComparison({
				customerId: "cust_2",
			});
			expect(remaining).toHaveLength(1);
		});
	});

	// --- deleteItem ---

	describe("deleteItem", () => {
		it("deletes a specific item", async () => {
			const item = await controller.addProduct(
				itemParams({ customerId: "cust_1" }),
			);
			const deleted = await controller.deleteItem(item.id);
			expect(deleted).toBe(true);

			const items = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(0);
		});

		it("returns false for non-existent item", async () => {
			const deleted = await controller.deleteItem("nonexistent");
			expect(deleted).toBe(false);
		});
	});

	// --- listAll ---

	describe("listAll", () => {
		it("returns all items across all customers", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			await controller.addProduct(
				itemParams({
					customerId: "cust_2",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const all = await controller.listAll();
			expect(all).toHaveLength(2);
		});

		it("filters by customerId", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			await controller.addProduct(
				itemParams({
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
			await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
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
				await controller.addProduct(
					itemParams({
						customerId: `cust_page_${i}`,
						productId: "prod_1",
						productSlug: "product-1",
					}),
				);
			}
			const page = await controller.listAll({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// --- countItems ---

	describe("countItems", () => {
		it("counts all items", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			await controller.addProduct(
				itemParams({
					customerId: "cust_2",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const count = await controller.countItems();
			expect(count).toBe(2);
		});

		it("counts items for a specific customer", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			await controller.addProduct(
				itemParams({
					customerId: "cust_2",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const count = await controller.countItems({
				customerId: "cust_1",
			});
			expect(count).toBe(1);
		});

		it("returns 0 when no items exist", async () => {
			const count = await controller.countItems();
			expect(count).toBe(0);
		});
	});

	// --- getFrequentlyCompared ---

	describe("getFrequentlyCompared", () => {
		it("returns products sorted by compare count", async () => {
			// Product A compared by 3 different customers
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						customerId: `cust_${i}`,
						productId: "prod_popular",
						productName: "Popular Product",
						productSlug: "popular",
					}),
				);
			}
			// Product B compared once
			await controller.addProduct(
				itemParams({
					customerId: "cust_0",
					productId: "prod_rare",
					productName: "Rare Product",
					productSlug: "rare",
				}),
			);

			const frequent = await controller.getFrequentlyCompared();
			expect(frequent).toHaveLength(2);
			expect(frequent[0].productId).toBe("prod_popular");
			expect(frequent[0].compareCount).toBe(3);
			expect(frequent[1].productId).toBe("prod_rare");
			expect(frequent[1].compareCount).toBe(1);
		});

		it("returns empty array when no items exist", async () => {
			const frequent = await controller.getFrequentlyCompared();
			expect(frequent).toHaveLength(0);
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.addProduct(
					itemParams({
						customerId: `cust_freq_${i}`,
						productId: `prod_${i}`,
						productSlug: `product-${i}`,
					}),
				);
			}
			const frequent = await controller.getFrequentlyCompared({ take: 5 });
			expect(frequent).toHaveLength(5);
		});

		it("includes product slug and image", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productImage: "/img/test.jpg",
				}),
			);
			const frequent = await controller.getFrequentlyCompared();
			expect(frequent[0].productSlug).toBe("test-product");
			expect(frequent[0].productImage).toBe("/img/test.jpg");
		});
	});

	// --- mergeComparison ---

	describe("mergeComparison", () => {
		it("transfers session items to customer", async () => {
			await controller.addProduct(
				itemParams({ sessionId: "sess_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productSlug: "p2",
					productName: "Product 2",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(2);

			// Customer now has the items
			const customerItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(customerItems).toHaveLength(2);

			// Session items are gone
			const sessionItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessionItems).toHaveLength(0);
		});

		it("skips products already in customer comparison", async () => {
			// Customer already has prod_1
			await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			// Session has prod_1 and prod_2
			await controller.addProduct(
				itemParams({ sessionId: "sess_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productSlug: "p2",
					productName: "Product 2",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			// Only prod_2 was merged, prod_1 was a duplicate
			expect(merged).toBe(1);

			const customerItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(customerItems).toHaveLength(2);
		});

		it("returns 0 when session has no items", async () => {
			const merged = await controller.mergeComparison({
				sessionId: "sess_empty",
				customerId: "cust_1",
			});
			expect(merged).toBe(0);
		});

		it("respects max products during merge", async () => {
			// Customer already has 3 items
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_cust_${i}`,
						productSlug: `prod-cust-${i}`,
					}),
				);
			}
			// Session has 3 items
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						sessionId: "sess_1",
						productId: `prod_sess_${i}`,
						productSlug: `prod-sess-${i}`,
					}),
				);
			}

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
				maxProducts: 4,
			});
			// Only 1 should merge (3 existing + 1 = 4 max)
			expect(merged).toBe(1);

			const customerItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(customerItems).toHaveLength(4);
		});
	});
});
