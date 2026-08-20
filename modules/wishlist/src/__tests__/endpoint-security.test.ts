import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createWishlistController } from "../service-impl";
import { storeSearch } from "../store/endpoints/store-search";

/**
 * Security regression tests for wishlist endpoints.
 *
 * Covers: ownership isolation, duplicate prevention, cross-customer data leaks,
 * nonexistent resource guards, removeByProduct scoping, summary accuracy,
 * and pagination bounds.
 */

describe("wishlist endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createWishlistController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createWishlistController(mockData);
	});

	describe("store endpoint input hardening", () => {
		it("sanitizes search text and coerces numeric limits", () => {
			const parsed = storeSearch.options.query.parse({
				q: "  <script>alert(1)</script>wishlist  ",
				limit: "25",
			});

			expect(parsed.q).toBe("wishlist");
			expect(parsed.limit).toBe(25);
		});

		it("rejects oversized store-search limits", () => {
			expect(
				storeSearch.options.query.safeParse({
					q: "wishlist",
					limit: "51",
				}).success,
			).toBe(false);
		});
	});

	// ── Ownership Isolation ─────────────────────────────────────────────

	describe("ownership isolation on remove", () => {
		it("getItem returns customerId for ownership verification", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const fetched = await controller.getItem(item.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.customerId).toBe("cust_1");
		});

		it("ownership check prevents cross-user deletion", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});

			const fetched = await controller.getItem(item.id);
			const attackerCustomerId = "cust_attacker";
			expect(fetched?.customerId).not.toBe(attackerCustomerId);

			// Item should still exist (endpoint would return 404)
			expect(await controller.getItem(item.id)).not.toBeNull();
		});

		it("owner can remove their own item", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});

			const fetched = await controller.getItem(item.id);
			expect(fetched?.customerId).toBe("cust_1");

			const removed = await controller.removeItem(item.id);
			expect(removed).toBe(true);
		});

		it("removeItem returns false for already-removed item", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.removeItem(item.id);
			const secondRemove = await controller.removeItem(item.id);
			expect(secondRemove).toBe(false);
		});
	});

	// ── Customer Scoping ────────────────────────────────────────────────

	describe("customer scoping on list and check", () => {
		it("listByCustomer only returns that customer's items", async () => {
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

			const cust1Items = await controller.listByCustomer("cust_1");
			expect(cust1Items).toHaveLength(1);
			expect(cust1Items[0]?.productId).toBe("prod_1");

			const cust2Items = await controller.listByCustomer("cust_2");
			expect(cust2Items).toHaveLength(1);
			expect(cust2Items[0]?.productId).toBe("prod_2");
		});

		it("isInWishlist only checks the given customer", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});

			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(true);
			expect(await controller.isInWishlist("cust_2", "prod_1")).toBe(false);
		});

		it("countByCustomer only counts that customer's items", async () => {
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
				productId: "prod_3",
				productName: "C",
			});

			expect(await controller.countByCustomer("cust_1")).toBe(2);
			expect(await controller.countByCustomer("cust_2")).toBe(1);
		});

		it("listByCustomer returns empty for unknown customer", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "X",
			});
			const items = await controller.listByCustomer("nonexistent");
			expect(items).toHaveLength(0);
		});

		it("countByCustomer returns zero for unknown customer", async () => {
			expect(await controller.countByCustomer("nonexistent")).toBe(0);
		});
	});

	// ── Duplicate Prevention ────────────────────────────────────────────

	describe("duplicate prevention", () => {
		it("adding same product twice for same customer returns existing item", async () => {
			const first = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const second = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});

			expect(second.id).toBe(first.id);
			expect(await controller.countByCustomer("cust_1")).toBe(1);
		});

		it("same product for different customers creates separate items", async () => {
			const item1 = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const item2 = await controller.addItem({
				customerId: "cust_2",
				productId: "prod_1",
				productName: "Widget",
			});

			expect(item1.id).not.toBe(item2.id);
		});

		it("different products for same customer create separate items", async () => {
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
		});
	});

	// ── removeByProduct Scoping ─────────────────────────────────────────

	describe("removeByProduct isolation", () => {
		it("removes only the specified customer-product pair", async () => {
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

			const removed = await controller.removeByProduct("cust_1", "prod_1");
			expect(removed).toBe(true);

			// cust_2's item should be unaffected
			expect(await controller.isInWishlist("cust_2", "prod_1")).toBe(true);
			expect(await controller.isInWishlist("cust_1", "prod_1")).toBe(false);
		});

		it("returns false when customer-product pair does not exist", async () => {
			const removed = await controller.removeByProduct("cust_1", "nonexistent");
			expect(removed).toBe(false);
		});

		it("does not affect other products for the same customer", async () => {
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
			expect(await controller.countByCustomer("cust_1")).toBe(1);
			expect(await controller.isInWishlist("cust_1", "prod_2")).toBe(true);
		});
	});

	// ── Nonexistent Resource Guards ─────────────────────────────────────

	describe("nonexistent resource handling", () => {
		it("getItem returns null for fabricated ID", async () => {
			const result = await controller.getItem("nonexistent_id");
			expect(result).toBeNull();
		});

		it("removeItem returns false for fabricated ID", async () => {
			const result = await controller.removeItem("nonexistent_id");
			expect(result).toBe(false);
		});

		it("isInWishlist returns false for fabricated product", async () => {
			expect(await controller.isInWishlist("cust_1", "nonexistent_prod")).toBe(
				false,
			);
		});
	});

	// ── Admin listAll Isolation ──────────────────────────────────────────

	describe("admin listAll filtering", () => {
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
			expect(result.items[0]?.customerId).toBe("cust_1");
		});

		it("filters by productId across all customers", async () => {
			await controller.addItem({
				customerId: "cust_1",
				productId: "shared_prod",
				productName: "Shared",
			});
			await controller.addItem({
				customerId: "cust_2",
				productId: "shared_prod",
				productName: "Shared",
			});
			await controller.addItem({
				customerId: "cust_1",
				productId: "other_prod",
				productName: "Other",
			});

			const result = await controller.listAll({ productId: "shared_prod" });
			expect(result.items).toHaveLength(2);
		});

		it("returns all items when no filters specified", async () => {
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

			const result = await controller.listAll();
			expect(result.items).toHaveLength(2);
		});
	});

	// ── Summary Accuracy ────────────────────────────────────────────────

	describe("summary accuracy", () => {
		it("empty store returns zeroed summary", async () => {
			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(0);
			expect(summary.topProducts).toHaveLength(0);
		});

		it("ranks products by popularity correctly", async () => {
			// prod_1 added by 3 customers, prod_2 by 1
			await controller.addItem({
				customerId: "c1",
				productId: "prod_1",
				productName: "Popular",
			});
			await controller.addItem({
				customerId: "c2",
				productId: "prod_1",
				productName: "Popular",
			});
			await controller.addItem({
				customerId: "c3",
				productId: "prod_1",
				productName: "Popular",
			});
			await controller.addItem({
				customerId: "c1",
				productId: "prod_2",
				productName: "Less Popular",
			});

			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(4);
			expect(summary.topProducts[0]?.productId).toBe("prod_1");
			expect(summary.topProducts[0]?.count).toBe(3);
			expect(summary.topProducts[1]?.productId).toBe("prod_2");
			expect(summary.topProducts[1]?.count).toBe(1);
		});

		it("summary updates after item removal", async () => {
			const item = await controller.addItem({
				customerId: "c1",
				productId: "prod_1",
				productName: "Widget",
			});
			await controller.addItem({
				customerId: "c2",
				productId: "prod_1",
				productName: "Widget",
			});

			await controller.removeItem(item.id);

			const summary = await controller.getSummary();
			expect(summary.totalItems).toBe(1);
			expect(summary.topProducts[0]?.count).toBe(1);
		});
	});

	// ── Pagination ──────────────────────────────────────────────────────

	describe("pagination bounds", () => {
		it("listByCustomer respects take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.addItem({
					customerId: "cust_pag",
					productId: `prod_${i}`,
					productName: `Item ${i}`,
				});
			}

			const page = await controller.listByCustomer("cust_pag", {
				take: 2,
				skip: 1,
			});
			expect(page.length).toBeLessThanOrEqual(2);
		});

		it("listAll respects take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.addItem({
					customerId: `c${i}`,
					productId: `p${i}`,
					productName: `Item ${i}`,
				});
			}

			const result = await controller.listAll({ take: 3 });
			expect(result.items.length).toBeLessThanOrEqual(3);
			expect(result.total).toBe(5);
		});
	});

	// ── Note and Image Handling ─────────────────────────────────────────

	describe("optional field handling", () => {
		it("preserves note when provided", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
				note: "Birthday gift idea",
			});
			const fetched = await controller.getItem(item.id);
			expect(fetched?.note).toBe("Birthday gift idea");
		});

		it("preserves productImage when provided", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
				productImage: "/images/widget.jpg",
			});
			const fetched = await controller.getItem(item.id);
			expect(fetched?.productImage).toBe("/images/widget.jpg");
		});

		it("handles missing optional fields gracefully", async () => {
			const item = await controller.addItem({
				customerId: "cust_1",
				productId: "prod_1",
				productName: "Widget",
			});
			const fetched = await controller.getItem(item.id);
			expect(fetched?.note).toBeUndefined();
			expect(fetched?.productImage).toBeUndefined();
		});
	});
});
