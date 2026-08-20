import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createComparisonController } from "../service-impl";

/**
 * Edge-case and boundary-condition tests for the comparisons controller.
 *
 * These tests complement the happy-path coverage in service-impl.test.ts
 * by exercising owner-precedence rules, merge edge cases, pagination
 * boundaries, sort-order guarantees, and multi-user isolation.
 */
describe("comparisons controller – edge cases", () => {
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

	// ── addProduct edge cases ──────────────────────────────────────────────

	describe("addProduct – owner precedence", () => {
		it("uses customerId when both customerId and sessionId are provided", async () => {
			const item = await controller.addProduct(
				itemParams({ customerId: "cust_1", sessionId: "sess_1" }),
			);

			// The owner filter uses customerId (first branch), so
			// the item should be findable by customerId
			const byCustomer = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(byCustomer).toHaveLength(1);
			expect(byCustomer[0].id).toBe(item.id);
		});

		it("detects duplicate via customerId even when sessionId is also given", async () => {
			const first = await controller.addProduct(
				itemParams({ customerId: "cust_1", sessionId: "sess_1" }),
			);
			const second = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					sessionId: "sess_1",
					productName: "Updated",
				}),
			);

			// Should update existing, not create new
			expect(second.id).toBe(first.id);
			expect(second.productName).toBe("Updated");
		});
	});

	describe("addProduct – boundary maxProducts values", () => {
		it("enforces maxProducts=1 so only one product is allowed", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_1",
					maxProducts: 1,
				}),
			);

			await expect(
				controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: "prod_2",
						productSlug: "p2",
						maxProducts: 1,
					}),
				),
			).rejects.toThrow(
				"Comparison limit reached. Maximum 1 products allowed.",
			);
		});

		it("includes the max count in the error message", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
						maxProducts: 3,
					}),
				);
			}
			await expect(
				controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: "prod_extra",
						productSlug: "extra",
						maxProducts: 3,
					}),
				),
			).rejects.toThrow("Maximum 3 products allowed");
		});

		it("allows updating existing product snapshot fields", async () => {
			const original = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productImage: "/old.jpg",
					productPrice: 100,
					productCategory: "A",
					attributes: { Color: "Red" },
				}),
			);

			const updated = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productImage: "/new.jpg",
					productPrice: 200,
					productCategory: "B",
					attributes: { Color: "Blue", Size: "M" },
				}),
			);

			expect(updated.id).toBe(original.id);
			expect(updated.productImage).toBe("/new.jpg");
			expect(updated.productPrice).toBe(200);
			expect(updated.productCategory).toBe("B");
			expect(updated.attributes).toEqual({ Color: "Blue", Size: "M" });
		});

		it("refreshes addedAt timestamp on update", async () => {
			const original = await controller.addProduct(
				itemParams({ customerId: "cust_1" }),
			);

			// Manually backdate
			const backdated = {
				...original,
				addedAt: new Date("2020-01-01"),
			};
			await mockData.upsert(
				"comparisonItem",
				original.id,
				backdated as Record<string, unknown>,
			);

			const updated = await controller.addProduct(
				itemParams({ customerId: "cust_1", productName: "Refreshed" }),
			);

			expect(updated.addedAt.getTime()).toBeGreaterThan(
				new Date("2020-01-01").getTime(),
			);
		});

		it("stores empty attributes object", async () => {
			const item = await controller.addProduct(
				itemParams({ customerId: "cust_1", attributes: {} }),
			);
			expect(item.attributes).toEqual({});
		});

		it("allows undefined optional fields", async () => {
			const item = await controller.addProduct(
				itemParams({ customerId: "cust_1" }),
			);
			expect(item.productImage).toBeUndefined();
			expect(item.productPrice).toBeUndefined();
			expect(item.productCategory).toBeUndefined();
			expect(item.attributes).toBeUndefined();
		});
	});

	describe("addProduct – session-based limits", () => {
		it("enforces max products for session-based comparisons", async () => {
			for (let i = 0; i < 2; i++) {
				await controller.addProduct(
					itemParams({
						sessionId: "sess_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
						maxProducts: 2,
					}),
				);
			}

			await expect(
				controller.addProduct(
					itemParams({
						sessionId: "sess_1",
						productId: "prod_extra",
						productSlug: "extra",
						maxProducts: 2,
					}),
				),
			).rejects.toThrow("Comparison limit reached");
		});

		it("separate session limits are independent", async () => {
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_1",
					maxProducts: 1,
				}),
			);
			// Different session should still allow adding
			const item = await controller.addProduct(
				itemParams({
					sessionId: "sess_2",
					productId: "prod_1",
					maxProducts: 1,
				}),
			);
			expect(item.sessionId).toBe("sess_2");
		});
	});

	// ── removeProduct edge cases ───────────────────────────────────────────

	describe("removeProduct – owner precedence", () => {
		it("uses customerId when both customerId and sessionId are provided", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));
			await controller.addProduct(itemParams({ sessionId: "sess_1" }));

			// Remove by customerId (should only remove cust_1's item)
			const removed = await controller.removeProduct({
				customerId: "cust_1",
				sessionId: "sess_1",
				productId: "prod_1",
			});
			expect(removed).toBe(true);

			// Customer item is gone
			const custItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(custItems).toHaveLength(0);

			// Session item still exists
			const sessItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessItems).toHaveLength(1);
		});

		it("removes only the targeted product, not others", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_1",
				}),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "p2",
					productName: "Product 2",
				}),
			);

			await controller.removeProduct({
				customerId: "cust_1",
				productId: "prod_1",
			});

			const remaining = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(remaining).toHaveLength(1);
			expect(remaining[0].productId).toBe("prod_2");
		});
	});

	// ── getComparison edge cases ───────────────────────────────────────────

	describe("getComparison – owner precedence and sorting", () => {
		it("uses customerId when both customerId and sessionId are provided", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_cust",
					productSlug: "cust",
				}),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_sess",
					productSlug: "sess",
				}),
			);

			const items = await controller.getComparison({
				customerId: "cust_1",
				sessionId: "sess_1",
			});
			// Should only return customer items (customerId branch takes precedence)
			expect(items).toHaveLength(1);
			expect(items[0].productId).toBe("prod_cust");
		});

		it("returns empty array for non-existent customer", async () => {
			const items = await controller.getComparison({
				customerId: "cust_nonexistent",
			});
			expect(items).toHaveLength(0);
		});

		it("returns empty array for non-existent session", async () => {
			const items = await controller.getComparison({
				sessionId: "sess_nonexistent",
			});
			expect(items).toHaveLength(0);
		});
	});

	// ── clearComparison edge cases ─────────────────────────────────────────

	describe("clearComparison – owner precedence", () => {
		it("uses customerId when both customerId and sessionId are provided", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_1",
				}),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const cleared = await controller.clearComparison({
				customerId: "cust_1",
				sessionId: "sess_1",
			});
			expect(cleared).toBe(1);

			// Customer items cleared
			const custItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(custItems).toHaveLength(0);

			// Session items untouched
			const sessItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessItems).toHaveLength(1);
		});

		it("returns 0 for non-existent customer", async () => {
			const cleared = await controller.clearComparison({
				customerId: "nonexistent",
			});
			expect(cleared).toBe(0);
		});

		it("clears multiple items and returns correct count", async () => {
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						sessionId: "sess_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
					}),
				);
			}

			const cleared = await controller.clearComparison({
				sessionId: "sess_1",
			});
			expect(cleared).toBe(4);
		});
	});

	// ── mergeComparison edge cases ─────────────────────────────────────────

	describe("mergeComparison – detailed edge cases", () => {
		it("returns 0 when all session items are duplicates of customer items", async () => {
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
			await controller.addProduct(
				itemParams({ sessionId: "sess_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			expect(merged).toBe(0);

			// Session items should be deleted
			const sessItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessItems).toHaveLength(0);

			// Customer items unchanged
			const custItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(custItems).toHaveLength(2);
		});

		it("deletes excess session items that exceed max during merge", async () => {
			// Customer has 4 items (at default max)
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_cust_${i}`,
						productSlug: `p-cust-${i}`,
					}),
				);
			}
			// Session has 2 non-duplicate items
			for (let i = 0; i < 2; i++) {
				await controller.addProduct(
					itemParams({
						sessionId: "sess_1",
						productId: `prod_sess_${i}`,
						productSlug: `p-sess-${i}`,
					}),
				);
			}

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			// Already at max (4), so no merges
			expect(merged).toBe(0);

			// Session items should be deleted (over limit)
			const sessItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessItems).toHaveLength(0);
		});

		it("merged items have customerId set and sessionId cleared", async () => {
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_1",
					productName: "Merged Product",
				}),
			);

			await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});

			const custItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(custItems).toHaveLength(1);
			expect(custItems[0].customerId).toBe("cust_1");
			expect(custItems[0].sessionId).toBeUndefined();
			expect(custItems[0].productName).toBe("Merged Product");
		});

		it("uses default max of 4 when maxProducts is not specified", async () => {
			// Customer has 3 items
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_cust_${i}`,
						productSlug: `p-cust-${i}`,
					}),
				);
			}
			// Session has 3 items
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						sessionId: "sess_1",
						productId: `prod_sess_${i}`,
						productSlug: `p-sess-${i}`,
					}),
				);
			}

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
			});
			// 3 existing + 1 merged = 4 (default max)
			expect(merged).toBe(1);

			const custItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(custItems).toHaveLength(4);

			// Remaining session items should have been deleted
			const sessItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessItems).toHaveLength(0);
		});

		it("handles mix of duplicates and non-duplicates with max constraint", async () => {
			// Customer has 2 items: prod_shared, prod_cust
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_shared",
					productSlug: "shared",
				}),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_cust",
					productSlug: "cust",
				}),
			);
			// Session has 3 items: prod_shared (dup), prod_new_1, prod_new_2
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_shared",
					productSlug: "shared",
				}),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_new_1",
					productSlug: "new1",
				}),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_new_2",
					productSlug: "new2",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
				maxProducts: 4,
			});
			// prod_shared is duplicate (deleted, not merged)
			// prod_new_1 transferred (2+1=3 < 4)
			// prod_new_2 transferred (2+2=4 = max)
			expect(merged).toBe(2);

			const custItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(custItems).toHaveLength(4);

			// All session items cleaned up
			const sessItems = await controller.getComparison({
				sessionId: "sess_1",
			});
			expect(sessItems).toHaveLength(0);
		});

		it("merges with maxProducts=1 when customer has 0 items", async () => {
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_1",
				}),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const merged = await controller.mergeComparison({
				sessionId: "sess_1",
				customerId: "cust_1",
				maxProducts: 1,
			});
			// Only 1 should merge
			expect(merged).toBe(1);

			const custItems = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(custItems).toHaveLength(1);
		});
	});

	// ── deleteItem edge cases ──────────────────────────────────────────────

	describe("deleteItem – isolation", () => {
		it("only deletes the targeted item, not others", async () => {
			const item1 = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_1",
				}),
			);
			const item2 = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			await controller.deleteItem(item1.id);

			const remaining = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(remaining).toHaveLength(1);
			expect(remaining[0].id).toBe(item2.id);
		});

		it("can delete a session-based item", async () => {
			const item = await controller.addProduct(
				itemParams({ sessionId: "sess_1" }),
			);

			const deleted = await controller.deleteItem(item.id);
			expect(deleted).toBe(true);

			const items = await controller.getComparison({ sessionId: "sess_1" });
			expect(items).toHaveLength(0);
		});

		it("delete is idempotent – second call returns false", async () => {
			const item = await controller.addProduct(
				itemParams({ customerId: "cust_1" }),
			);

			expect(await controller.deleteItem(item.id)).toBe(true);
			expect(await controller.deleteItem(item.id)).toBe(false);
		});
	});

	// ── listAll edge cases ─────────────────────────────────────────────────

	describe("listAll – sorting and combined filters", () => {
		it("returns items sorted by addedAt descending (newest first)", async () => {
			const first = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_old",
					productSlug: "old",
				}),
			);
			// Backdate the first item
			const backdated = {
				...first,
				addedAt: new Date("2020-01-01"),
			};
			await mockData.upsert(
				"comparisonItem",
				first.id,
				backdated as Record<string, unknown>,
			);

			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_new",
					productSlug: "new",
				}),
			);

			const all = await controller.listAll();
			expect(all).toHaveLength(2);
			// Newest first (opposite of getComparison)
			expect(all[0].productId).toBe("prod_new");
			expect(all[1].productId).toBe("prod_old");
		});

		it("filters by both customerId and productId simultaneously", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_1",
				}),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_2",
					productId: "prod_1",
				}),
			);

			const filtered = await controller.listAll({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(filtered).toHaveLength(1);
			expect(filtered[0].customerId).toBe("cust_1");
			expect(filtered[0].productId).toBe("prod_1");
		});

		it("returns empty array with no data", async () => {
			const all = await controller.listAll();
			expect(all).toHaveLength(0);
		});

		it("returns empty array for non-matching filter", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));

			const filtered = await controller.listAll({
				customerId: "cust_nonexistent",
			});
			expect(filtered).toHaveLength(0);
		});

		it("pagination with take=0 returns empty", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));

			const page = await controller.listAll({ take: 0 });
			expect(page).toHaveLength(0);
		});

		it("skip beyond total returns empty", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));

			const page = await controller.listAll({ skip: 100 });
			expect(page).toHaveLength(0);
		});

		it("includes session-based items in listAll", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const all = await controller.listAll();
			expect(all).toHaveLength(2);
		});
	});

	// ── countItems edge cases ──────────────────────────────────────────────

	describe("countItems – combined filters", () => {
		it("counts by productId across customers", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({ customerId: "cust_2", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const count = await controller.countItems({ productId: "prod_1" });
			expect(count).toBe(2);
		});

		it("counts by both customerId and productId", async () => {
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
			await controller.addProduct(
				itemParams({ customerId: "cust_2", productId: "prod_1" }),
			);

			const count = await controller.countItems({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(count).toBe(1);
		});

		it("returns 0 for non-matching customer", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));

			const count = await controller.countItems({
				customerId: "nonexistent",
			});
			expect(count).toBe(0);
		});

		it("returns 0 for non-matching product", async () => {
			await controller.addProduct(itemParams({ customerId: "cust_1" }));

			const count = await controller.countItems({
				productId: "nonexistent",
			});
			expect(count).toBe(0);
		});
	});

	// ── getFrequentlyCompared edge cases ───────────────────────────────────

	describe("getFrequentlyCompared – edge cases", () => {
		it("default take is 10", async () => {
			// Create 15 distinct products compared once each
			for (let i = 0; i < 15; i++) {
				await controller.addProduct(
					itemParams({
						customerId: `cust_${i}`,
						productId: `prod_${i}`,
						productSlug: `product-${i}`,
						productName: `Product ${i}`,
					}),
				);
			}

			const frequent = await controller.getFrequentlyCompared();
			expect(frequent).toHaveLength(10);
		});

		it("uses snapshot data from the first comparison entry for a product", async () => {
			// First comparison has image /first.jpg
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_1",
					productName: "First Name",
					productSlug: "first-slug",
					productImage: "/first.jpg",
				}),
			);

			const frequent = await controller.getFrequentlyCompared();
			expect(frequent).toHaveLength(1);
			expect(frequent[0].productName).toBe("First Name");
			expect(frequent[0].productSlug).toBe("first-slug");
			expect(frequent[0].productImage).toBe("/first.jpg");
		});

		it("handles products with no image", async () => {
			await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_no_img",
					productSlug: "no-img",
					productName: "No Image",
				}),
			);

			const frequent = await controller.getFrequentlyCompared();
			expect(frequent).toHaveLength(1);
			expect(frequent[0].productImage).toBeUndefined();
		});

		it("ranks products by total comparison count correctly", async () => {
			// prod_a: compared by 5 customers
			for (let i = 0; i < 5; i++) {
				await controller.addProduct(
					itemParams({
						customerId: `cust_a_${i}`,
						productId: "prod_a",
						productSlug: "a",
						productName: "Product A",
					}),
				);
			}
			// prod_b: compared by 3 customers
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						customerId: `cust_b_${i}`,
						productId: "prod_b",
						productSlug: "b",
						productName: "Product B",
					}),
				);
			}
			// prod_c: compared by 1 customer
			await controller.addProduct(
				itemParams({
					customerId: "cust_c_0",
					productId: "prod_c",
					productSlug: "c",
					productName: "Product C",
				}),
			);

			const frequent = await controller.getFrequentlyCompared();
			expect(frequent).toHaveLength(3);
			expect(frequent[0].productId).toBe("prod_a");
			expect(frequent[0].compareCount).toBe(5);
			expect(frequent[1].productId).toBe("prod_b");
			expect(frequent[1].compareCount).toBe(3);
			expect(frequent[2].productId).toBe("prod_c");
			expect(frequent[2].compareCount).toBe(1);
		});

		it("take=1 returns only the most compared product", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						customerId: `cust_${i}`,
						productId: "prod_popular",
						productSlug: "popular",
						productName: "Popular",
					}),
				);
			}
			await controller.addProduct(
				itemParams({
					customerId: "cust_0",
					productId: "prod_rare",
					productSlug: "rare",
					productName: "Rare",
				}),
			);

			const top = await controller.getFrequentlyCompared({ take: 1 });
			expect(top).toHaveLength(1);
			expect(top[0].productId).toBe("prod_popular");
			expect(top[0].compareCount).toBe(3);
		});
	});

	// ── Multi-user isolation ───────────────────────────────────────────────

	describe("multi-user isolation", () => {
		it("different customers have fully independent comparison lists", async () => {
			// Customer 1 adds 3 products
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
						productName: `Product ${i}`,
					}),
				);
			}
			// Customer 2 adds 1 product
			await controller.addProduct(
				itemParams({
					customerId: "cust_2",
					productId: "prod_99",
					productSlug: "p-99",
				}),
			);

			const c1 = await controller.getComparison({ customerId: "cust_1" });
			const c2 = await controller.getComparison({ customerId: "cust_2" });
			expect(c1).toHaveLength(3);
			expect(c2).toHaveLength(1);

			// Clear customer 1 should not affect customer 2
			await controller.clearComparison({ customerId: "cust_1" });
			const c1After = await controller.getComparison({ customerId: "cust_1" });
			const c2After = await controller.getComparison({ customerId: "cust_2" });
			expect(c1After).toHaveLength(0);
			expect(c2After).toHaveLength(1);
		});

		it("different sessions have fully independent comparison lists", async () => {
			await controller.addProduct(
				itemParams({ sessionId: "sess_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_2",
					productId: "prod_2",
					productSlug: "p2",
				}),
			);

			const s1 = await controller.getComparison({ sessionId: "sess_1" });
			const s2 = await controller.getComparison({ sessionId: "sess_2" });
			expect(s1).toHaveLength(1);
			expect(s1[0].productId).toBe("prod_1");
			expect(s2).toHaveLength(1);
			expect(s2[0].productId).toBe("prod_2");
		});

		it("customer and session comparisons are separate namespaces", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({ sessionId: "sess_1", productId: "prod_1" }),
			);

			// Each has 1 item despite same productId
			const cust = await controller.getComparison({ customerId: "cust_1" });
			const sess = await controller.getComparison({ sessionId: "sess_1" });
			expect(cust).toHaveLength(1);
			expect(sess).toHaveLength(1);

			// Total should be 2
			const total = await controller.countItems();
			expect(total).toBe(2);
		});

		it("removing product for one customer does not affect another", async () => {
			await controller.addProduct(
				itemParams({ customerId: "cust_1", productId: "prod_1" }),
			);
			await controller.addProduct(
				itemParams({ customerId: "cust_2", productId: "prod_1" }),
			);

			await controller.removeProduct({
				customerId: "cust_1",
				productId: "prod_1",
			});

			const c1 = await controller.getComparison({ customerId: "cust_1" });
			const c2 = await controller.getComparison({ customerId: "cust_2" });
			expect(c1).toHaveLength(0);
			expect(c2).toHaveLength(1);
		});
	});

	// ── Workflow / integration-style tests ─────────────────────────────────

	describe("full workflows", () => {
		it("session → merge → customer lifecycle", async () => {
			// Anonymous user browses and adds products to comparison
			await controller.addProduct(
				itemParams({
					sessionId: "sess_anon",
					productId: "prod_1",
					productName: "Widget",
					productSlug: "widget",
					productPrice: 999,
				}),
			);
			await controller.addProduct(
				itemParams({
					sessionId: "sess_anon",
					productId: "prod_2",
					productName: "Gadget",
					productSlug: "gadget",
					productPrice: 1999,
				}),
			);

			// Verify session comparison
			const sessItems = await controller.getComparison({
				sessionId: "sess_anon",
			});
			expect(sessItems).toHaveLength(2);

			// User logs in → merge session to customer
			const merged = await controller.mergeComparison({
				sessionId: "sess_anon",
				customerId: "cust_buyer",
			});
			expect(merged).toBe(2);

			// Customer now has both items
			const custItems = await controller.getComparison({
				customerId: "cust_buyer",
			});
			expect(custItems).toHaveLength(2);

			// Session is empty
			const sessAfter = await controller.getComparison({
				sessionId: "sess_anon",
			});
			expect(sessAfter).toHaveLength(0);

			// Customer removes one product
			await controller.removeProduct({
				customerId: "cust_buyer",
				productId: "prod_1",
			});
			const afterRemove = await controller.getComparison({
				customerId: "cust_buyer",
			});
			expect(afterRemove).toHaveLength(1);
			expect(afterRemove[0].productId).toBe("prod_2");

			// Customer clears comparison
			const cleared = await controller.clearComparison({
				customerId: "cust_buyer",
			});
			expect(cleared).toBe(1);

			const final = await controller.getComparison({
				customerId: "cust_buyer",
			});
			expect(final).toHaveLength(0);
		});

		it("add up to limit, remove one, add another works", async () => {
			// Fill to max (4)
			for (let i = 0; i < 4; i++) {
				await controller.addProduct(
					itemParams({
						customerId: "cust_1",
						productId: `prod_${i}`,
						productSlug: `p-${i}`,
					}),
				);
			}

			// Remove one
			await controller.removeProduct({
				customerId: "cust_1",
				productId: "prod_0",
			});

			// Now should be able to add a new one
			const newItem = await controller.addProduct(
				itemParams({
					customerId: "cust_1",
					productId: "prod_new",
					productSlug: "new",
				}),
			);
			expect(newItem.productId).toBe("prod_new");

			const items = await controller.getComparison({
				customerId: "cust_1",
			});
			expect(items).toHaveLength(4);
		});

		it("getFrequentlyCompared reflects actual state after deletions", async () => {
			// Add products across multiple customers
			for (let i = 0; i < 3; i++) {
				await controller.addProduct(
					itemParams({
						customerId: `cust_${i}`,
						productId: "prod_popular",
						productSlug: "popular",
						productName: "Popular",
					}),
				);
			}

			// Delete one comparison
			const items = await controller.getComparison({ customerId: "cust_0" });
			await controller.deleteItem(items[0].id);

			const frequent = await controller.getFrequentlyCompared();
			expect(frequent).toHaveLength(1);
			expect(frequent[0].compareCount).toBe(2);
		});
	});
});
