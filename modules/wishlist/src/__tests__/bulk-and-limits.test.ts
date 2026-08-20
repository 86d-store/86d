import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWishlistController } from "../service-impl";

describe("wishlist bulk operations and limits", () => {
	let mockData: ReturnType<typeof createMockDataService>;

	beforeEach(() => {
		mockData = createMockDataService();
	});

	// ── maxItems enforcement ────────────────────────────────────────────

	describe("maxItems enforcement", () => {
		it("allows adding items up to maxItems limit", async () => {
			const controller = createWishlistController(mockData, {
				maxItems: 3,
			});
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
			const item3 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_3",
				productName: "C",
			});
			expect(item3.productName).toBe("C");
			expect(await controller.countByCustomer("cust_1")).toBe(3);
		});

		it("throws error when exceeding maxItems limit", async () => {
			const controller = createWishlistController(mockData, {
				maxItems: 2,
			});
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
			await expect(
				controller.addItem({
					customerId: "cust_1",
					productId: "prod_3",
					productName: "C",
				}),
			).rejects.toThrow("Wishlist limit reached (max 2 items)");
		});

		it("maxItems is per customer, not global", async () => {
			const controller = createWishlistController(mockData, {
				maxItems: 2,
			});
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
			// cust_2 can still add
			const item = await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "A",
			});
			expect(item.customerId).toBe("cust_2");
		});

		it("duplicate add does not count toward limit", async () => {
			const controller = createWishlistController(mockData, {
				maxItems: 1,
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			// Re-adding the same product should return existing, not throw
			const duplicate = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			expect(duplicate.productId).toBe("prod_1");
		});

		it("removing an item frees up a slot", async () => {
			const controller = createWishlistController(mockData, {
				maxItems: 1,
			});
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			await expect(
				controller.addItem({
					customerId: "cust_1",
					productId: "prod_2",
					productName: "B",
				}),
			).rejects.toThrow("Wishlist limit reached");
			await controller.removeItem(item.id);
			const newItem = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_2",
				productName: "B",
			});
			expect(newItem.productId).toBe("prod_2");
		});

		it("no limit when maxItems is undefined", async () => {
			const controller = createWishlistController(mockData);
			for (let i = 0; i < 100; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			expect(await controller.countByCustomer("cust_1")).toBe(100);
		});

		it("no limit when maxItems is 0", async () => {
			const controller = createWishlistController(mockData, {
				maxItems: 0,
			});
			for (let i = 0; i < 10; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			expect(await controller.countByCustomer("cust_1")).toBe(10);
		});

		it("maxItems of 1 allows exactly one item", async () => {
			const controller = createWishlistController(mockData, {
				maxItems: 1,
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});
			await expect(
				controller.addItem({
					customerId: "cust_1",
					productId: "prod_2",
					productName: "B",
				}),
			).rejects.toThrow("Wishlist limit reached");
		});
	});

	// ── bulkRemove ──────────────────────────────────────────────────────

	describe("bulkRemove", () => {
		it("removes multiple items at once", async () => {
			const controller = createWishlistController(mockData);
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
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_3",
				productName: "C",
			});

			const removed = await controller.bulkRemove("cust_1", [
				item1.id,
				item2.id,
			]);
			expect(removed).toBe(2);
			expect(await controller.countByCustomer("cust_1")).toBe(1);
		});

		it("only removes items owned by the customer", async () => {
			const controller = createWishlistController(mockData);
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

			const removed = await controller.bulkRemove("cust_1", [
				item1.id,
				item2.id,
			]);
			expect(removed).toBe(1);
			// cust_2's item should still exist
			expect(await controller.getItem(item2.id)).not.toBeNull();
		});

		it("returns 0 for empty array", async () => {
			const controller = createWishlistController(mockData);
			const removed = await controller.bulkRemove("cust_1", []);
			expect(removed).toBe(0);
		});

		it("returns 0 for non-existent IDs", async () => {
			const controller = createWishlistController(mockData);
			const removed = await controller.bulkRemove("cust_1", [
				"fake_1",
				"fake_2",
			]);
			expect(removed).toBe(0);
		});

		it("handles mix of valid and invalid IDs", async () => {
			const controller = createWishlistController(mockData);
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});

			const removed = await controller.bulkRemove("cust_1", [
				item.id,
				"fake_1",
				"fake_2",
			]);
			expect(removed).toBe(1);
		});

		it("handles duplicate IDs in the array", async () => {
			const controller = createWishlistController(mockData);
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "A",
			});

			const removed = await controller.bulkRemove("cust_1", [item.id, item.id]);
			// First removal succeeds, second finds nothing
			expect(removed).toBe(1);
		});
	});

	// ── listAll pagination total ────────────────────────────────────────

	describe("listAll pagination total", () => {
		it("total reflects all matching items, not just page size", async () => {
			const controller = createWishlistController(mockData);
			for (let i = 0; i < 10; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			const result = await controller.listAll({
				customerId: "cust_1",
				take: 3,
				skip: 0,
			});
			expect(result.items).toHaveLength(3);
			expect(result.total).toBe(10);
		});

		it("total is consistent across pages", async () => {
			const controller = createWishlistController(mockData);
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
			expect(page1.total).toBe(7);
			expect(page2.total).toBe(7);
			expect(page3.total).toBe(7);
			expect(page1.items).toHaveLength(3);
			expect(page2.items).toHaveLength(3);
			expect(page3.items).toHaveLength(1);
		});

		it("total with filter reflects filtered count only", async () => {
			const controller = createWishlistController(mockData);
			for (let i = 0; i < 5; i++) {
				await controller.addItem({
					customerId: "cust_1",
					productId: `prod_${i}`,
					productName: `Product ${i}`,
				});
			}
			for (let i = 0; i < 3; i++) {
				await controller.addItem({
					customerId: "cust_2",
					productId: `prod_other_${i}`,
					productName: `Other ${i}`,
				});
			}
			const result = await controller.listAll({
				customerId: "cust_1",
				take: 2,
			});
			expect(result.items).toHaveLength(2);
			expect(result.total).toBe(5);
		});
	});
});
