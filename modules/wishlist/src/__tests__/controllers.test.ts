import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWishlistController } from "../service-impl";

describe("wishlist controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWishlistController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWishlistController(mockData);
	});

	// ── addItem edge cases ──────────────────────────────────────────────

	describe("addItem edge cases", () => {
		it("duplicate add preserves original note and image, ignores new values", async () => {
			const original = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
				productImage: "https://example.com/old.jpg",
				note: "Original note",
			});
			const duplicate = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget Updated",
				productImage: "https://example.com/new.jpg",
				note: "Updated note",
			});
			expect(duplicate.id).toBe(original.id);
			expect(duplicate.productImage).toBe("https://example.com/old.jpg");
			expect(duplicate.note).toBe("Original note");
			expect(duplicate.productName).toBe("Widget");
		});

		it("each new item gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const item = await controller.addItem({
					customerId: `cust_${i}`,
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
				ids.add(item.id);
			}
			expect(ids.size).toBe(20);
		});

		it("addedAt is set to approximately current time", async () => {
			const before = new Date();
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const after = new Date();
			expect(item.addedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(item.addedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("handles empty string values for optional fields", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
				productImage: "",
				note: "",
			});
			expect(item.productImage).toBe("");
			expect(item.note).toBe("");
		});

		it("handles special characters in product name and note", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: 'Widget "Pro" <br> & Co.',
				note: "Gift for mom! \n\t Special chars: @#$%^&*()",
			});
			expect(item.productName).toBe('Widget "Pro" <br> & Co.');
			expect(item.note).toBe("Gift for mom! \n\t Special chars: @#$%^&*()");
		});

		it("handles very long strings in fields", async () => {
			const longName = "A".repeat(10000);
			const longNote = "B".repeat(10000);
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: longName,
				note: longNote,
			});
			expect(item.productName).toBe(longName);
			expect(item.note).toBe(longNote);
		});
	});

	// ── removeItem edge cases ───────────────────────────────────────────

	describe("removeItem edge cases", () => {
		it("double removal returns false on second attempt", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			expect(await controller.removeItem(item.id)).toBe(true);
			expect(await controller.removeItem(item.id)).toBe(false);
		});

		it("removing one item does not affect other items", async () => {
			const item1 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget A",
			});
			const item2 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "Widget B",
			});
			await controller.removeItem(item1.id);
			const remaining = await controller.getItem(item2.id);
			expect(remaining).not.toBeNull();
			expect(remaining?.productId).toBe("prod_2");
		});

		it("returns false for empty string id", async () => {
			const result = await controller.removeItem("");
			expect(result).toBe(false);
		});
	});

	// ── removeByProduct edge cases ──────────────────────────────────────

	describe("removeByProduct edge cases", () => {
		it("returns false when customer matches but product does not", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const result = await controller.removeByProduct("cust_1", "prod_99");
			expect(result).toBe(false);
			// Original item still exists
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
		});

		it("returns false when product matches but customer does not", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const result = await controller.removeByProduct("cust_99", "prod_1");
			expect(result).toBe(false);
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
		});

		it("double removeByProduct returns false on second attempt", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			expect(await controller.removeByProduct("cust_1", "prod_1")).toBe(true);
			expect(await controller.removeByProduct("cust_1", "prod_1")).toBe(false);
		});

		it("removes and allows re-adding the same product", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.removeByProduct("cust_1", "prod_1");
			const readded = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget v2",
			});
			expect(readded.productName).toBe("Widget v2");
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
		});
	});

	// ── getItem edge cases ──────────────────────────────────────────────

	describe("getItem edge cases", () => {
		it("returns correct item when many items exist", async () => {
			const items: Awaited<ReturnType<typeof controller.addItem>>[] = [];
			for (let i = 0; i < 10; i++) {
				const item = await controller.addItem({
					customerId: `cust_${i}`,
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
				items.push(item);
			}
			// Fetch one from the middle
			const fetched = await controller.getItem(items[5].id);
			expect(fetched).not.toBeNull();
			expect(fetched?.customerId).toBe("cust_5");
			expect(fetched?.productId).toBe("prod_5");
		});

		it("returns null after the item has been removed by product", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.removeByProduct("cust_1", "prod_1");
			const fetched = await controller.getItem(item.id);
			expect(fetched).toBeNull();
		});
	});

	// ── isInWishlist edge cases ─────────────────────────────────────────

	describe("isInWishlist edge cases", () => {
		it("returns false after removeByProduct", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.removeByProduct("cust_1", "prod_1");
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(false);
		});

		it("correctly distinguishes between products for same customer", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget A",
			});
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
			expect(await controller.isInWishlist("cust_1", "prod_2")).toBe(false);
		});

		it("returns true after re-adding a previously removed item", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.removeItem(item.id);
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(false);
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
		});
	});

	// ── listByCustomer edge cases ───────────────────────────────────────

	describe("listByCustomer edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const items = await controller.listByCustomer("cust_1", {
				take: 0,
			});
			expect(items).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total items", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const items = await controller.listByCustomer("cust_1", {
				skip: 100,
			});
			expect(items).toHaveLength(0);
		});

		it("returns all items when only skip=0 is provided", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const items = await controller.listByCustomer("cust_1", {
				skip: 0,
			});
			expect(items).toHaveLength(3);
		});

		it("handles take larger than total items", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const items = await controller.listByCustomer("cust_1", {
				take: 100,
			});
			expect(items).toHaveLength(1);
		});

		it("paginates correctly through all items", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const page1 = await controller.listByCustomer("cust_1", {
				take: 2,
				skip: 0,
			});
			const page2 = await controller.listByCustomer("cust_1", {
				take: 2,
				skip: 2,
			});
			const page3 = await controller.listByCustomer("cust_1", {
				take: 2,
				skip: 4,
			});
			expect(page1).toHaveLength(2);
			expect(page2).toHaveLength(2);
			expect(page3).toHaveLength(1);
			// All items are unique
			const allIds = [
				...page1.map((i) => i.id),
				...page2.map((i) => i.id),
				...page3.map((i) => i.id),
			];
			expect(new Set(allIds).size).toBe(5);
		});

		it("returns no params without pagination (undefined params)", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const items = await controller.listByCustomer("cust_1");
			expect(items).toHaveLength(3);
		});

		it("reflects removals in subsequent list calls", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "Gadget",
			});
			expect(await controller.listByCustomer("cust_1")).toHaveLength(2);
			await controller.removeItem(item.id);
			const after = await controller.listByCustomer("cust_1");
			expect(after).toHaveLength(1);
			expect(after[0].productId).toBe("prod_2");
		});
	});

	// ── listAll edge cases ──────────────────────────────────────────────

	describe("listAll edge cases", () => {
		it("filters by both customerId and productId simultaneously", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "B",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "A",
			});
			const result = await controller.listAll({
				customerId: "cust_1",
				productId: "prod_1",
			});
			expect(result.items).toHaveLength(1);
			expect(result.items[0].customerId).toBe("cust_1");
			expect(result.items[0].productId).toBe("prod_1");
		});

		it("returns empty when combined filters match nothing", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			const result = await controller.listAll({
				customerId: "cust_1",
				productId: "prod_99",
			});
			expect(result.items).toHaveLength(0);
			expect(result.total).toBe(0);
		});

		it("returns empty array with take=0", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			const result = await controller.listAll({ take: 0 });
			expect(result.items).toHaveLength(0);
			expect(result.total).toBe(1);
		});

		it("returns empty when skip exceeds total", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			const result = await controller.listAll({ skip: 100 });
			expect(result.items).toHaveLength(0);
			expect(result.total).toBe(1);
		});

		it("paginates all items correctly", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.addItem({
					customerId: `cust_${i}`,
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const page1 = await controller.listAll({ take: 3, skip: 0 });
			const page2 = await controller.listAll({ take: 3, skip: 3 });
			const page3 = await controller.listAll({ take: 3, skip: 6 });
			expect(page1.items).toHaveLength(3);
			expect(page2.items).toHaveLength(3);
			expect(page3.items).toHaveLength(1);
			expect(page1.total).toBe(7);
		});

		it("returns all items with empty params object", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_2",
				productName: "B",
			});
			const result = await controller.listAll({});
			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it("applies pagination with filters", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_other",
				productName: "Other",
			});
			const result = await controller.listAll({
				customerId: "cust_1",
				take: 2,
				skip: 1,
			});
			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(5);
			for (const item of result.items) {
				expect(item.customerId).toBe("cust_1");
			}
		});
	});

	// ── countByCustomer edge cases ──────────────────────────────────────

	describe("countByCustomer edge cases", () => {
		it("reflects removal via removeByProduct", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "B",
			});
			expect(await controller.countByCustomer("cust_1")).toBe(2);
			await controller.removeByProduct("cust_1", "prod_1");
			expect(await controller.countByCustomer("cust_1")).toBe(1);
		});

		it("returns 0 after all items removed", async () => {
			const item1 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			const item2 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "B",
			});
			await controller.removeItem(item1.id);
			await controller.removeItem(item2.id);
			expect(await controller.countByCustomer("cust_1")).toBe(0);
		});

		it("increments correctly for many items", async () => {
			for (let i = 0; i < 50; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			expect(await controller.countByCustomer("cust_1")).toBe(50);
		});

		it("duplicate adds do not increment count", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			expect(await controller.countByCustomer("cust_1")).toBe(1);
		});
	});

	// ── getSummary edge cases ───────────────────────────────────────────

	describe("getSummary edge cases", () => {
		it("summary updates after item removal", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const item2 = await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "Widget",
			});
			expect((await controller.getSummary()).totalItems).toBe(2);
			await controller.removeItem(item2.id);
			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(1);
			expect(summary.topProducts[0].count).toBe(1);
		});

		it("correctly aggregates exactly 10 products", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.addItem({
					customerId: `cust_${i}`,
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(10);
			expect(summary.topProducts).toHaveLength(10);
		});

		it("truncates to 10 when more than 10 distinct products", async () => {
			// Create 12 products with varying counts so we can verify top 10
			for (let i = 0; i < 12; i++) {
				// Each product gets (12 - i) wishlists so they have distinct counts
				for (let j = 0; j < 12 - i; j++) {
					await controller.addItem({
						customerId: `cust_${i}_${j}`,
						productId: `prod_${i}`,
						productName: `Product ${i}`,
					});
				}
			}
			const summary = await controller.getSummary();
			expect(summary.topProducts).toHaveLength(10);
			// The top product should have the highest count
			expect(summary.topProducts[0].count).toBe(12);
			// The 10th product should be prod_9 with count 3
			expect(summary.topProducts[9].count).toBe(3);
		});

		it("handles products with equal counts in top products", async () => {
			// 5 products each with exactly 2 wishlists
			for (let i = 0; i < 5; i++) {
				await controller.addItem({
					customerId: "cust_a",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
				await controller.addItem({
					customerId: "cust_b",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(10);
			expect(summary.topProducts).toHaveLength(5);
			for (const product of summary.topProducts) {
				expect(product.count).toBe(2);
			}
		});

		it("single item summary", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Solo Widget",
			});
			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(1);
			expect(summary.topProducts).toHaveLength(1);
			expect(summary.topProducts[0]).toEqual({
				productId: "prod_1",
				productName: "Solo Widget",
				count: 1,
			});
		});

		it("summary reflects empty state after clearing all items", async () => {
			const item1 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			const item2 = await controller.addItem({
				customerId: "cust_2",
				productId: "prod_2",
				productName: "B",
			});
			await controller.removeItem(item1.id);
			await controller.removeItem(item2.id);
			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(0);
			expect(summary.topProducts).toHaveLength(0);
		});

		it("uses first-seen product name for aggregation", async () => {
			// When same productId is added by different customers, the
			// summary entry productName comes from whichever entry the Map
			// first encounters (which is the first insert).
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Original Name",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "Original Name",
			});
			const summary = await controller.getSummary();
			expect(summary.topProducts[0].productName).toBe("Original Name");
		});
	});

	// ── multi-user interleaved operations ───────────────────────────────

	describe("multi-user interleaved operations", () => {
		it("three customers each manage independent wishlists", async () => {
			// Customer 1 adds 3 items
			for (let i = 0; i < 3; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			// Customer 2 adds 2 items
			for (let i = 0; i < 2; i++) {
				await controller.addItem({
					customerId: "cust_2",
					productId: `prod_${i + 10}`,
					productName: `Product ${i + 10}`,
				});
			}
			// Customer 3 adds 1 item
			await controller.addItem({
				customerId: "cust_3",
				productId: "prod_20",
				productName: "Product 20",
			});

			expect(await controller.countByCustomer("cust_1")).toBe(3);
			expect(await controller.countByCustomer("cust_2")).toBe(2);
			expect(await controller.countByCustomer("cust_3")).toBe(1);

			// Remove cust_2's items
			await controller.removeByProduct("cust_2", "prod_10");
			await controller.removeByProduct("cust_2", "prod_11");

			expect(await controller.countByCustomer("cust_2")).toBe(0);
			// Others unaffected
			expect(await controller.countByCustomer("cust_1")).toBe(3);
			expect(await controller.countByCustomer("cust_3")).toBe(1);

			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(4);
		});

		it("shared products tracked per-customer in summary", async () => {
			// 3 customers all wishlist the same product
			for (let i = 1; i <= 3; i++) {
				await controller.addItem({
					customerId: `cust_${i}`,
					productId: "prod_shared",
					productName: "Shared Widget",
				});
			}
			// 2 customers wishlist another product
			for (let i = 1; i <= 2; i++) {
				await controller.addItem({
					customerId: `cust_${i}`,
					productId: "prod_other",
					productName: "Other Widget",
				});
			}

			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(5);
			expect(summary.topProducts[0].productId).toBe("prod_shared");
			expect(summary.topProducts[0].count).toBe(3);
			expect(summary.topProducts[1].productId).toBe("prod_other");
			expect(summary.topProducts[1].count).toBe(2);
		});

		it("removing one customer does not affect shared product count for others", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Shared",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "Shared",
			});
			await controller.addItem({
				customerId: "cust_3",
				productId: "prod_1",
				productName: "Shared",
			});

			await controller.removeByProduct("cust_2", "prod_1");

			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
			expect(await controller.isInWishlist("cust_2", "prod_1")).toBe(false);
			expect(await controller.isInWishlist("cust_3", "prod_1")).toBe(true);

			const summary = await controller.getSummary();
			expect(summary.topProducts[0].count).toBe(2);
		});
	});

	// ── data store isolation ────────────────────────────────────────────

	describe("data store consistency", () => {
		it("internal store key count matches expected items", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_2",
				productName: "B",
			});
			expect(mockData.size("wishlistItem")).toBe(2);
		});

		it("store is empty after removing all items", async () => {
			const item1 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			const item2 = await controller.addItem({
				customerId: "cust_2",
				productId: "prod_2",
				productName: "B",
			});
			await controller.removeItem(item1.id);
			await controller.removeItem(item2.id);
			expect(mockData.size("wishlistItem")).toBe(0);
		});

		it("duplicate add does not create additional store entries", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget Again",
			});
			expect(mockData.size("wishlistItem")).toBe(1);
		});
	});

	// ── boundary / stress ───────────────────────────────────────────────

	describe("boundary conditions", () => {
		it("handles many items for a single customer", async () => {
			for (let i = 0; i < 100; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			expect(await controller.countByCustomer("cust_1")).toBe(100);
			const items = await controller.listByCustomer("cust_1");
			expect(items).toHaveLength(100);
		});

		it("summary handles many distinct products with varying counts", async () => {
			// Create 15 products, each with (15-i) wishlists
			for (let i = 0; i < 15; i++) {
				for (let j = 0; j <= i; j++) {
					await controller.addItem({
						customerId: `cust_${i}_${j}`,
						productId: `prod_${i}`,
						productName: `Product ${i}`,
					});
				}
			}
			const summary = await controller.getSummary();
			// Top 10 should be products 14..5 with counts 15..6
			expect(summary.topProducts).toHaveLength(10);
			expect(summary.topProducts[0].count).toBe(15);
			expect(summary.topProducts[9].count).toBe(6);
		});

		it("listAll with no arguments returns everything", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.addItem({
					customerId: `cust_${i}`,
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const all = await controller.listAll();
			expect(all.items).toHaveLength(10);
			expect(all.total).toBe(10);
		});

		it("listByCustomer with skip=0 and take=undefined returns all", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const items = await controller.listByCustomer("cust_1", {
				skip: 0,
			});
			expect(items).toHaveLength(5);
		});
	});

	// ── full complex lifecycle ──────────────────────────────────────────

	describe("complex lifecycle scenarios", () => {
		it("add, remove some, re-add, verify counts and summary", async () => {
			// Add items for cust_1
			const a = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_a",
				productName: "Alpha",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_b",
				productName: "Beta",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_c",
				productName: "Gamma",
			});

			// Add items for cust_2
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_a",
				productName: "Alpha",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_d",
				productName: "Delta",
			});

			// Verify initial state
			expect(await controller.countByCustomer("cust_1")).toBe(3);
			expect(await controller.countByCustomer("cust_2")).toBe(2);
			let summary = await controller.getSummary();
			expect(summary.totalItems).toBe(5);

			// Remove one by id
			await controller.removeItem(a.id);
			expect(await controller.countByCustomer("cust_1")).toBe(2);
			expect(await controller.isInWishlist("cust_1", "prod_a")).toBe(false);
			// cust_2 still has prod_a
			expect(await controller.isInWishlist("cust_2", "prod_a")).toBe(true);

			// Re-add prod_a for cust_1
			const aNew = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_a",
				productName: "Alpha Reloaded",
			});
			expect(aNew.id).not.toBe(a.id);
			expect(aNew.productName).toBe("Alpha Reloaded");
			expect(await controller.countByCustomer("cust_1")).toBe(3);

			// Remove by product for cust_2
			await controller.removeByProduct("cust_2", "prod_d");
			expect(await controller.countByCustomer("cust_2")).toBe(1);

			// Final summary
			summary = await controller.getSummary();
			expect(summary.totalItems).toBe(4);
			// prod_a has 2 wishlists (cust_1 re-added + cust_2)
			expect(summary.topProducts[0].productId).toBe("prod_a");
			expect(summary.topProducts[0].count).toBe(2);
		});

		it("listAll filters remain accurate after mutations", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "B",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "A",
			});

			// Filter by prod_1 - should get 2
			let filtered = await controller.listAll({ productId: "prod_1" });
			expect(filtered.items).toHaveLength(2);

			// Remove cust_1's prod_1
			await controller.removeByProduct("cust_1", "prod_1");

			// Now filter by prod_1 - should get 1
			filtered = await controller.listAll({ productId: "prod_1" });
			expect(filtered.items).toHaveLength(1);
			expect(filtered.items[0].customerId).toBe("cust_2");

			// Filter by cust_1 - should get 1 (prod_2)
			filtered = await controller.listAll({ customerId: "cust_1" });
			expect(filtered.items).toHaveLength(1);
			expect(filtered.items[0].productId).toBe("prod_2");
		});
	});
});
