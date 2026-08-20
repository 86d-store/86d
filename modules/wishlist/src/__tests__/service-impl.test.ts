import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWishlistController } from "../service-impl";

describe("createWishlistController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWishlistController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWishlistController(mockData);
	});

	// ── addItem ──────────────────────────────────────────────────────────

	describe("addItem", () => {
		it("adds an item to the wishlist", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test Product",
			});
			expect(item.id).toBeDefined();
			expect(item.customerId).toBe("cust_1");
			expect(item.productId).toBe("prod_1");
			expect(item.productName).toBe("Test Product");
			expect(item.addedAt).toBeInstanceOf(Date);
		});

		it("stores optional fields", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test Product",
				productImage: "https://example.com/img.jpg",
				note: "For birthday",
			});
			expect(item.productImage).toBe("https://example.com/img.jpg");
			expect(item.note).toBe("For birthday");
		});

		it("returns existing item on duplicate (idempotent)", async () => {
			const first = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test Product",
			});
			const second = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test Product",
			});
			expect(second.id).toBe(first.id);
		});

		it("allows same product for different customers", async () => {
			const item1 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test Product",
			});
			const item2 = await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "Test Product",
			});
			expect(item1.id).not.toBe(item2.id);
		});

		it("allows different products for same customer", async () => {
			const item1 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Product A",
			});
			const item2 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "Product B",
			});
			expect(item1.id).not.toBe(item2.id);
		});

		it("leaves optional fields undefined when not provided", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test",
			});
			expect(item.productImage).toBeUndefined();
			expect(item.note).toBeUndefined();
		});
	});

	// ── removeItem ───────────────────────────────────────────────────────

	describe("removeItem", () => {
		it("removes an existing item", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test",
			});
			const result = await controller.removeItem(item.id);
			expect(result).toBe(true);
			const found = await controller.getItem(item.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent item", async () => {
			const result = await controller.removeItem("missing");
			expect(result).toBe(false);
		});
	});

	// ── removeByProduct ──────────────────────────────────────────────────

	describe("removeByProduct", () => {
		it("removes item by customer and product combination", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test",
			});
			const result = await controller.removeByProduct("cust_1", "prod_1");
			expect(result).toBe(true);
			const inList = await controller.isInWishlist("cust_1", "prod_1");
			expect(inList).toBe(false);
		});

		it("returns false when not in wishlist", async () => {
			const result = await controller.removeByProduct("cust_1", "prod_1");
			expect(result).toBe(false);
		});

		it("does not affect other customers' wishlists", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "Test",
			});
			await controller.removeByProduct("cust_1", "prod_1");
			const stillExists = await controller.isInWishlist("cust_2", "prod_1");
			expect(stillExists).toBe(true);
		});

		it("does not affect other products for same customer", async () => {
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
			await controller.removeByProduct("cust_1", "prod_1");
			const other = await controller.isInWishlist("cust_1", "prod_2");
			expect(other).toBe(true);
		});
	});

	// ── getItem ──────────────────────────────────────────────────────────

	describe("getItem", () => {
		it("returns an existing item", async () => {
			const created = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test",
			});
			const found = await controller.getItem(created.id);
			expect(found?.productId).toBe("prod_1");
		});

		it("returns null for non-existent item", async () => {
			const found = await controller.getItem("missing");
			expect(found).toBeNull();
		});
	});

	// ── isInWishlist ─────────────────────────────────────────────────────

	describe("isInWishlist", () => {
		it("returns true when item exists", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test",
			});
			const result = await controller.isInWishlist("cust_1", "prod_1");
			expect(result).toBe(true);
		});

		it("returns false when item does not exist", async () => {
			const result = await controller.isInWishlist("cust_1", "prod_1");
			expect(result).toBe(false);
		});

		it("returns false after item is removed", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test",
			});
			await controller.removeItem(item.id);
			const result = await controller.isInWishlist("cust_1", "prod_1");
			expect(result).toBe(false);
		});

		it("distinguishes between customers for same product", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Test",
			});
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
			expect(await controller.isInWishlist("cust_2", "prod_1")).toBe(false);
		});
	});

	// ── listByCustomer ───────────────────────────────────────────────────

	describe("listByCustomer", () => {
		it("lists items for a specific customer", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Product 1",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "Product 2",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_3",
				productName: "Product 3",
			});
			const items = await controller.listByCustomer("cust_1");
			expect(items).toHaveLength(2);
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const page = await controller.listByCustomer("cust_1", {
				take: 2,
				skip: 1,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty array for customer with no items", async () => {
			const items = await controller.listByCustomer("cust_empty");
			expect(items).toHaveLength(0);
		});
	});

	// ── listAll ──────────────────────────────────────────────────────────

	describe("listAll", () => {
		it("lists all wishlist items with total", async () => {
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
			const all = await controller.listAll();
			expect(all.items).toHaveLength(2);
			expect(all.total).toBe(2);
		});

		it("filters by customerId", async () => {
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
			const result = await controller.listAll({ customerId: "cust_1" });
			expect(result.items).toHaveLength(1);
			expect(result.total).toBe(1);
		});

		it("filters by productId", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "A",
			});
			await controller.addItem({
				customerId: "cust_3",
				productId: "prod_2",
				productName: "B",
			});
			const result = await controller.listAll({ productId: "prod_1" });
			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(2);
		});

		it("supports take and skip with correct total", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.addItem({
					customerId: `cust_${i}`,
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const page = await controller.listAll({ take: 2, skip: 1 });
			expect(page.items).toHaveLength(2);
			expect(page.total).toBe(5);
		});

		it("returns empty result when no items", async () => {
			const all = await controller.listAll();
			expect(all.items).toHaveLength(0);
			expect(all.total).toBe(0);
		});

		it("returns empty for non-matching filter", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			const result = await controller.listAll({ customerId: "cust_99" });
			expect(result.items).toHaveLength(0);
			expect(result.total).toBe(0);
		});
	});

	// ── countByCustomer ──────────────────────────────────────────────────

	describe("countByCustomer", () => {
		it("counts items for a customer", async () => {
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
			const count = await controller.countByCustomer("cust_1");
			expect(count).toBe(2);
		});

		it("returns 0 for customer with no items", async () => {
			const count = await controller.countByCustomer("cust_empty");
			expect(count).toBe(0);
		});

		it("decrements after removal", async () => {
			const item = await controller.addItem({
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
			await controller.removeItem(item.id);
			expect(await controller.countByCustomer("cust_1")).toBe(1);
		});

		it("counts only for the specified customer", async () => {
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
			expect(await controller.countByCustomer("cust_1")).toBe(1);
			expect(await controller.countByCustomer("cust_2")).toBe(1);
		});
	});

	// ── getSummary ───────────────────────────────────────────────────────

	describe("getSummary", () => {
		it("returns summary with total and top products", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Popular Item",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "Popular Item",
			});
			await controller.addItem({
				customerId: "cust_3",
				productId: "prod_1",
				productName: "Popular Item",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "Another Item",
			});

			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(4);
			expect(summary.topProducts).toHaveLength(2);
			expect(summary.topProducts[0].productId).toBe("prod_1");
			expect(summary.topProducts[0].count).toBe(3);
		});

		it("returns empty summary when no items", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(0);
			expect(summary.topProducts).toHaveLength(0);
		});

		it("limits top products to 10", async () => {
			for (let i = 0; i < 15; i++) {
				await controller.addItem({
					customerId: `cust_${i}`,
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const summary = await controller.getSummary();
			expect(summary.topProducts.length).toBeLessThanOrEqual(10);
		});

		it("sorts top products by count descending", async () => {
			// prod_1 gets 3 wishlists, prod_2 gets 2, prod_3 gets 1
			for (let i = 0; i < 3; i++) {
				await controller.addItem({
					customerId: `cust_a${i}`,
					productId: "prod_1",
					productName: "Most Popular",
				});
			}
			for (let i = 0; i < 2; i++) {
				await controller.addItem({
					customerId: `cust_b${i}`,
					productId: "prod_2",
					productName: "Second Popular",
				});
			}
			await controller.addItem({
				customerId: "cust_c0",
				productId: "prod_3",
				productName: "Least Popular",
			});

			const summary = await controller.getSummary();
			expect(summary.topProducts).toHaveLength(3);
			expect(summary.topProducts[0].count).toBe(3);
			expect(summary.topProducts[1].count).toBe(2);
			expect(summary.topProducts[2].count).toBe(1);
		});

		it("includes product name in top products", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget Pro",
			});
			const summary = await controller.getSummary();
			expect(summary.topProducts[0].productName).toBe("Widget Pro");
		});
	});

	// ── full lifecycle ───────────────────────────────────────────────────

	describe("full lifecycle", () => {
		it("add → check → remove → re-add", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
			expect(await controller.countByCustomer("cust_1")).toBe(1);

			await controller.removeItem(item.id);
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(false);
			expect(await controller.countByCustomer("cust_1")).toBe(0);

			const readded = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			expect(readded.id).not.toBe(item.id);
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
		});

		it("add → removeByProduct → count reflects removal", async () => {
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

		it("multiple customers build summary", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Hot Item",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "Hot Item",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "Niche Item",
			});

			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(3);
			expect(summary.topProducts[0].productId).toBe("prod_1");
			expect(summary.topProducts[0].count).toBe(2);
		});

		it("getItem returns full data after add", async () => {
			const added = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget Pro",
				productImage: "https://example.com/widget.jpg",
				note: "Gift for friend",
			});
			const fetched = await controller.getItem(added.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.customerId).toBe("cust_1");
			expect(fetched?.productName).toBe("Widget Pro");
			expect(fetched?.productImage).toBe("https://example.com/widget.jpg");
			expect(fetched?.note).toBe("Gift for friend");
		});
	});
});
