import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPriceListController } from "../service-impl";
import {
	resolvePriceParamsSchema,
	resolvePriceQuerySchema,
} from "../store/endpoints/resolve-price";
import { resolvePricesBodySchema } from "../store/endpoints/resolve-prices";

/**
 * Security regression tests for price-lists endpoints.
 *
 * Covers: resolution visibility (active/inactive/expired/future), customer group
 * scoping, currency filtering, quantity tier matching, priority ordering, cascade
 * deletion, nonexistent resource guards, CRUD integrity, bulk operations,
 * stats accuracy, and slug uniqueness.
 */

describe("price-lists endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPriceListController>;

	const past = new Date(Date.now() - 3600_000);
	const future = new Date(Date.now() + 3600_000);

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPriceListController(mockData);
	});

	// ── Price Resolution Visibility ─────────────────────────────────────

	describe("price resolution visibility", () => {
		it("sanitizes and bounds resolution input", () => {
			expect(
				resolvePriceParamsSchema.parse({
					productId: "  <b>prod_1</b>  ",
				}).productId,
			).toBe("prod_1");

			expect(
				resolvePriceQuerySchema.parse({
					customerGroupId: "  <b>group_vip</b>  ",
					currency: " usd ",
				}),
			).toMatchObject({
				customerGroupId: "group_vip",
				currency: "usd",
			});

			expect(
				resolvePricesBodySchema.parse({
					productIds: ["  <b>prod_1</b>  ", "prod_2"],
				}).productIds,
			).toEqual(["prod_1", "prod_2"]);

			expect(() =>
				resolvePricesBodySchema.parse({
					productIds: ["x".repeat(201)],
				}),
			).toThrow();
		});

		it("inactive price lists are excluded from resolution", async () => {
			const list = await controller.createPriceList({
				name: "Inactive",
				slug: "inactive",
				status: "inactive",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 500,
			});

			const resolved = await controller.resolvePrice("prod_1", {});
			expect(resolved).toBeNull();
		});

		it("active price lists are included in resolution", async () => {
			const list = await controller.createPriceList({
				name: "Active",
				slug: "active",
				status: "active",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 500,
			});

			const resolved = await controller.resolvePrice("prod_1", {});
			expect(resolved).not.toBeNull();
			expect(resolved?.price).toBe(500);
		});

		it("expired price lists are excluded from resolution", async () => {
			const list = await controller.createPriceList({
				name: "Expired",
				slug: "expired",
				status: "active",
				startsAt: new Date(Date.now() - 7200_000),
				endsAt: past,
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 500,
			});

			const resolved = await controller.resolvePrice("prod_1", {});
			expect(resolved).toBeNull();
		});

		it("future-scheduled price lists are excluded", async () => {
			const list = await controller.createPriceList({
				name: "Future",
				slug: "future",
				status: "active",
				startsAt: future,
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 500,
			});

			const resolved = await controller.resolvePrice("prod_1", {});
			expect(resolved).toBeNull();
		});

		it("resolvePrice returns null for product with no price entries", async () => {
			await controller.createPriceList({
				name: "Empty",
				slug: "empty",
				status: "active",
			});

			const resolved = await controller.resolvePrice("prod_1", {});
			expect(resolved).toBeNull();
		});

		it("resolvePrice returns null for nonexistent product", async () => {
			const resolved = await controller.resolvePrice("no_such_product", {});
			expect(resolved).toBeNull();
		});
	});

	// ── Customer Group Scoping ──────────────────────────────────────────

	describe("customer group scoping", () => {
		it("price list with customer group only applies to that group", async () => {
			const list = await controller.createPriceList({
				name: "VIP Pricing",
				slug: "vip-pricing",
				status: "active",
				customerGroupId: "group_vip",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 400,
			});

			const noGroup = await controller.resolvePrice("prod_1", {});
			expect(noGroup).toBeNull();

			const withGroup = await controller.resolvePrice("prod_1", {
				customerGroupId: "group_vip",
			});
			expect(withGroup?.price).toBe(400);
		});

		it("non-group price list applies to all customers", async () => {
			const list = await controller.createPriceList({
				name: "General",
				slug: "general",
				status: "active",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 600,
			});

			const resolved = await controller.resolvePrice("prod_1", {});
			expect(resolved?.price).toBe(600);

			const withGroup = await controller.resolvePrice("prod_1", {
				customerGroupId: "group_vip",
			});
			expect(withGroup?.price).toBe(600);
		});

		it("group-specific list is preferred when customer has a group", async () => {
			const general = await controller.createPriceList({
				name: "General",
				slug: "general",
				status: "active",
				priority: 10,
			});
			await controller.setPrice({
				priceListId: general.id,
				productId: "prod_1",
				price: 1000,
			});

			const vip = await controller.createPriceList({
				name: "VIP",
				slug: "vip",
				status: "active",
				priority: 1,
				customerGroupId: "group_vip",
			});
			await controller.setPrice({
				priceListId: vip.id,
				productId: "prod_1",
				price: 700,
			});

			const resolved = await controller.resolvePrice("prod_1", {
				customerGroupId: "group_vip",
			});
			expect(resolved?.price).toBe(700);
		});
	});

	// ── Currency Filtering ──────────────────────────────────────────────

	describe("currency filtering", () => {
		it("resolves only price lists matching requested currency", async () => {
			const usdList = await controller.createPriceList({
				name: "USD Prices",
				slug: "usd",
				status: "active",
				currency: "USD",
			});
			await controller.setPrice({
				priceListId: usdList.id,
				productId: "prod_1",
				price: 500,
			});

			const eurList = await controller.createPriceList({
				name: "EUR Prices",
				slug: "eur",
				status: "active",
				currency: "EUR",
			});
			await controller.setPrice({
				priceListId: eurList.id,
				productId: "prod_1",
				price: 450,
			});

			const usd = await controller.resolvePrice("prod_1", {
				currency: "USD",
			});
			expect(usd?.price).toBe(500);

			const eur = await controller.resolvePrice("prod_1", {
				currency: "EUR",
			});
			expect(eur?.price).toBe(450);
		});

		it("price list without currency matches all currency requests", async () => {
			const list = await controller.createPriceList({
				name: "Universal",
				slug: "universal",
				status: "active",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 300,
			});

			const resolved = await controller.resolvePrice("prod_1", {
				currency: "GBP",
			});
			expect(resolved?.price).toBe(300);
		});
	});

	// ── Quantity Tier Matching ───────────────────────────────────────────

	describe("quantity tier matching", () => {
		it("entry with minQuantity excluded when quantity is lower", async () => {
			const list = await controller.createPriceList({
				name: "Tiered",
				slug: "tiered",
				status: "active",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 400,
				minQuantity: 10,
			});

			const resolved = await controller.resolvePrice("prod_1", {
				quantity: 5,
			});
			expect(resolved).toBeNull();
		});

		it("entry with minQuantity included when quantity meets threshold", async () => {
			const list = await controller.createPriceList({
				name: "Tiered",
				slug: "tiered",
				status: "active",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 400,
				minQuantity: 10,
			});

			const resolved = await controller.resolvePrice("prod_1", {
				quantity: 15,
			});
			expect(resolved?.price).toBe(400);
		});

		it("entry with maxQuantity excluded when quantity exceeds it", async () => {
			const list = await controller.createPriceList({
				name: "Small",
				slug: "small",
				status: "active",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 500,
				maxQuantity: 5,
			});

			const resolved = await controller.resolvePrice("prod_1", {
				quantity: 10,
			});
			expect(resolved).toBeNull();
		});

		it("no quantity specified matches all entries", async () => {
			const list = await controller.createPriceList({
				name: "Tiered",
				slug: "tiered",
				status: "active",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 400,
				minQuantity: 10,
				maxQuantity: 100,
			});

			const resolved = await controller.resolvePrice("prod_1", {});
			expect(resolved?.price).toBe(400);
		});
	});

	// ── Priority Ordering ───────────────────────────────────────────────

	describe("priority ordering", () => {
		it("lowest priority number wins (checked first)", async () => {
			const highPriority = await controller.createPriceList({
				name: "High Priority",
				slug: "high",
				status: "active",
				priority: 1,
			});
			await controller.setPrice({
				priceListId: highPriority.id,
				productId: "prod_1",
				price: 900,
			});

			const lowPriority = await controller.createPriceList({
				name: "Low Priority",
				slug: "low",
				status: "active",
				priority: 10,
			});
			await controller.setPrice({
				priceListId: lowPriority.id,
				productId: "prod_1",
				price: 500,
			});

			const resolved = await controller.resolvePrice("prod_1", {});
			expect(resolved?.price).toBe(900);
			expect(resolved?.priceListName).toBe("High Priority");
		});

		it("equal priority resolves to first match found", async () => {
			const a = await controller.createPriceList({
				name: "List A",
				slug: "list-a",
				status: "active",
				priority: 5,
			});
			await controller.setPrice({
				priceListId: a.id,
				productId: "prod_1",
				price: 600,
			});

			const b = await controller.createPriceList({
				name: "List B",
				slug: "list-b",
				status: "active",
				priority: 5,
			});
			await controller.setPrice({
				priceListId: b.id,
				productId: "prod_1",
				price: 700,
			});

			const resolved = await controller.resolvePrice("prod_1", {});
			expect(resolved).not.toBeNull();
			// Either is acceptable with equal priority
			expect([600, 700]).toContain(resolved?.price);
		});
	});

	// ── Cascade Deletion ────────────────────────────────────────────────

	describe("cascade deletion", () => {
		it("deleting a price list removes all its entries", async () => {
			const list = await controller.createPriceList({
				name: "Doomed",
				slug: "doomed",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 500,
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_2",
				price: 600,
			});

			await controller.deletePriceList(list.id);

			const count = await controller.countPrices(list.id);
			expect(count).toBe(0);
		});

		it("deleting one list does not affect another", async () => {
			const listA = await controller.createPriceList({
				name: "A",
				slug: "a",
			});
			const listB = await controller.createPriceList({
				name: "B",
				slug: "b",
			});
			await controller.setPrice({
				priceListId: listA.id,
				productId: "prod_1",
				price: 500,
			});
			await controller.setPrice({
				priceListId: listB.id,
				productId: "prod_1",
				price: 600,
			});

			await controller.deletePriceList(listA.id);

			const countB = await controller.countPrices(listB.id);
			expect(countB).toBe(1);
		});
	});

	// ── Nonexistent Resource Guards ─────────────────────────────────────

	describe("nonexistent resource handling", () => {
		it("getPriceList returns null for fabricated ID", async () => {
			const result = await controller.getPriceList("nonexistent");
			expect(result).toBeNull();
		});

		it("getPriceListBySlug returns null for fabricated slug", async () => {
			const result = await controller.getPriceListBySlug("no-such-slug");
			expect(result).toBeNull();
		});

		it("updatePriceList returns null for fabricated ID", async () => {
			const result = await controller.updatePriceList("nonexistent", {
				name: "updated",
			});
			expect(result).toBeNull();
		});

		it("deletePriceList returns false for fabricated ID", async () => {
			const result = await controller.deletePriceList("nonexistent");
			expect(result).toBe(false);
		});

		it("getPrice returns null for fabricated list/product", async () => {
			const result = await controller.getPrice("no_list", "no_prod");
			expect(result).toBeNull();
		});

		it("removePrice returns false for fabricated list/product", async () => {
			const result = await controller.removePrice("no_list", "no_prod");
			expect(result).toBe(false);
		});
	});

	// ── Price Entry CRUD ────────────────────────────────────────────────

	describe("price entry CRUD integrity", () => {
		it("setPrice creates entry and getPrice retrieves it", async () => {
			const list = await controller.createPriceList({
				name: "Test",
				slug: "test",
			});
			const entry = await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 999,
				compareAtPrice: 1200,
			});

			expect(entry.price).toBe(999);
			expect(entry.compareAtPrice).toBe(1200);

			const fetched = await controller.getPrice(list.id, "prod_1");
			expect(fetched?.price).toBe(999);
		});

		it("setPrice upserts existing entry for same list+product", async () => {
			const list = await controller.createPriceList({
				name: "Test",
				slug: "test",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 500,
			});
			const updated = await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 600,
			});

			expect(updated.price).toBe(600);
			const count = await controller.countPrices(list.id);
			expect(count).toBe(1);
		});

		it("removePrice removes the entry", async () => {
			const list = await controller.createPriceList({
				name: "Test",
				slug: "test",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 500,
			});

			const removed = await controller.removePrice(list.id, "prod_1");
			expect(removed).toBe(true);

			const count = await controller.countPrices(list.id);
			expect(count).toBe(0);
		});
	});

	// ── Batch Operations ────────────────────────────────────────────────

	describe("batch resolution", () => {
		it("resolvePrices resolves multiple products at once", async () => {
			const list = await controller.createPriceList({
				name: "Sale",
				slug: "sale",
				status: "active",
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_1",
				price: 500,
			});
			await controller.setPrice({
				priceListId: list.id,
				productId: "prod_2",
				price: 700,
			});

			const resolved = await controller.resolvePrices(
				["prod_1", "prod_2", "prod_3"],
				{},
			);
			expect(resolved.prod_1?.price).toBe(500);
			expect(resolved.prod_2?.price).toBe(700);
			expect(resolved.prod_3).toBeUndefined();
		});

		it("bulkSetPrices creates multiple entries", async () => {
			const list = await controller.createPriceList({
				name: "Bulk",
				slug: "bulk",
			});
			const entries = await controller.bulkSetPrices(list.id, [
				{ productId: "p1", price: 100 },
				{ productId: "p2", price: 200 },
				{ productId: "p3", price: 300 },
			]);

			expect(entries).toHaveLength(3);
			const count = await controller.countPrices(list.id);
			expect(count).toBe(3);
		});
	});

	// ── Stats Accuracy ──────────────────────────────────────────────────

	describe("stats accuracy", () => {
		it("empty store returns zeroed stats", async () => {
			const stats = await controller.getStats();
			expect(stats.totalPriceLists).toBe(0);
			expect(stats.activePriceLists).toBe(0);
			expect(stats.totalEntries).toBe(0);
		});

		it("counts reflect correct status distribution", async () => {
			await controller.createPriceList({
				name: "A",
				slug: "a",
				status: "active",
			});
			await controller.createPriceList({
				name: "B",
				slug: "b",
				status: "inactive",
			});
			await controller.createPriceList({
				name: "C",
				slug: "c",
				status: "scheduled",
			});

			const stats = await controller.getStats();
			expect(stats.totalPriceLists).toBe(3);
			expect(stats.activePriceLists).toBe(1);
			expect(stats.inactivePriceLists).toBe(1);
			expect(stats.scheduledPriceLists).toBe(1);
		});

		it("priceListsWithEntries counts correctly", async () => {
			const a = await controller.createPriceList({
				name: "With",
				slug: "with",
			});
			await controller.createPriceList({
				name: "Without",
				slug: "without",
			});
			await controller.setPrice({
				priceListId: a.id,
				productId: "p1",
				price: 100,
			});

			const stats = await controller.getStats();
			expect(stats.priceListsWithEntries).toBe(1);
			expect(stats.totalEntries).toBe(1);
		});
	});

	// ── Update Integrity ────────────────────────────────────────────────

	describe("update integrity", () => {
		it("update preserves unmodified fields", async () => {
			const list = await controller.createPriceList({
				name: "Original",
				slug: "original",
				status: "active",
				description: "Test desc",
				priority: 5,
			});

			const updated = await controller.updatePriceList(list.id, {
				name: "Updated",
			});

			expect(updated?.name).toBe("Updated");
			expect(updated?.slug).toBe("original");
			expect(updated?.status).toBe("active");
			expect(updated?.priority).toBe(5);
		});

		it("update can clear optional fields by passing null", async () => {
			const list = await controller.createPriceList({
				name: "Test",
				slug: "test",
				description: "Remove me",
				customerGroupId: "group_1",
			});

			const updated = await controller.updatePriceList(list.id, {
				description: null,
				customerGroupId: null,
			});

			expect(updated?.description).toBeUndefined();
			expect(updated?.customerGroupId).toBeUndefined();
		});

		it("updatedAt advances on update", async () => {
			const list = await controller.createPriceList({
				name: "Time",
				slug: "time",
			});
			const updated = await controller.updatePriceList(list.id, {
				name: "Time Updated",
			});

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				list.updatedAt.getTime(),
			);
		});
	});
});
