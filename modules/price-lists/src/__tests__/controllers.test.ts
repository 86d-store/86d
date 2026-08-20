import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPriceListController } from "../service-impl";

describe("price-list controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createPriceListController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createPriceListController(mockData);
	});

	async function createTestPriceList(
		overrides: Partial<Parameters<typeof controller.createPriceList>[0]> = {},
	) {
		return controller.createPriceList({
			name: "Wholesale",
			slug: `wholesale-${crypto.randomUUID().slice(0, 8)}`,
			...overrides,
		});
	}

	// ── Upsert semantics for setPrice ────────────────────────────────

	describe("setPrice — upsert semantics", () => {
		it("upserts same product/tier combination preserving createdAt", async () => {
			const pl = await createTestPriceList();
			const first = await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});
			const second = await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 8,
			});

			expect(second.id).toBe(first.id);
			expect(second.price).toBe(8);
			expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
		});

		it("upserts matching quantity tier but not mismatched tiers", async () => {
			const pl = await createTestPriceList();
			const tierA = await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
				minQuantity: 1,
				maxQuantity: 9,
			});
			const tierB = await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 7,
				minQuantity: 10,
				maxQuantity: 99,
			});

			// Now update tierA specifically
			const updatedA = await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 9,
				minQuantity: 1,
				maxQuantity: 9,
			});

			expect(updatedA.id).toBe(tierA.id);
			expect(updatedA.price).toBe(9);
			// tierB should remain unchanged
			const entry = await controller.getPrice(pl.id, "prod-1");
			expect(entry).not.toBeNull();
			// Both entries exist
			const count = await controller.countPrices(pl.id);
			expect(count).toBe(2);
			// tierB is untouched
			expect(tierB.price).toBe(7);
		});

		it("no-tier entry and tiered entry for same product coexist", async () => {
			const pl = await createTestPriceList();
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 20,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 15,
				minQuantity: 10,
				maxQuantity: 50,
			});

			const count = await controller.countPrices(pl.id);
			expect(count).toBe(2);
		});

		it("updating compareAtPrice via upsert", async () => {
			const pl = await createTestPriceList();
			const first = await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
				compareAtPrice: 15,
			});
			const second = await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
				compareAtPrice: 20,
			});

			expect(second.id).toBe(first.id);
			expect(second.compareAtPrice).toBe(20);
		});
	});

	// ── bulkSetPrices — edge cases ───────────────────────────────────

	describe("bulkSetPrices — edge cases", () => {
		it("bulk set with empty array returns empty results", async () => {
			const pl = await createTestPriceList();
			const results = await controller.bulkSetPrices(pl.id, []);
			expect(results).toHaveLength(0);
		});

		it("bulk set upserts existing entries rather than creating duplicates", async () => {
			const pl = await createTestPriceList();
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 50,
			});

			await controller.bulkSetPrices(pl.id, [
				{ productId: "prod-1", price: 40 },
				{ productId: "prod-2", price: 30 },
			]);

			const count = await controller.countPrices(pl.id);
			expect(count).toBe(2);
		});

		it("bulk set with duplicate productIds processes sequentially (last wins)", async () => {
			const pl = await createTestPriceList();
			const results = await controller.bulkSetPrices(pl.id, [
				{ productId: "prod-1", price: 10 },
				{ productId: "prod-1", price: 5 },
			]);

			expect(results).toHaveLength(2);
			// Both share the same id because the second upserts the first
			expect(results[0].id).toBe(results[1].id);
			expect(results[1].price).toBe(5);

			const count = await controller.countPrices(pl.id);
			expect(count).toBe(1);
		});

		it("bulk set with quantity tiers creates distinct entries", async () => {
			const pl = await createTestPriceList();
			const results = await controller.bulkSetPrices(pl.id, [
				{ productId: "prod-1", price: 10, minQuantity: 1, maxQuantity: 9 },
				{
					productId: "prod-1",
					price: 8,
					minQuantity: 10,
					maxQuantity: 49,
				},
				{ productId: "prod-1", price: 6, minQuantity: 50 },
			]);

			expect(results).toHaveLength(3);
			expect(results[0].id).not.toBe(results[1].id);
			expect(results[1].id).not.toBe(results[2].id);
		});
	});

	// ── removePrice — multi-tier cleanup ─────────────────────────────

	describe("removePrice — multi-tier cleanup", () => {
		it("removes all tiers for a product in one call", async () => {
			const pl = await createTestPriceList();
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
				minQuantity: 1,
				maxQuantity: 9,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 8,
				minQuantity: 10,
				maxQuantity: 99,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 6,
				minQuantity: 100,
			});

			expect(await controller.countPrices(pl.id)).toBe(3);

			const removed = await controller.removePrice(pl.id, "prod-1");
			expect(removed).toBe(true);
			expect(await controller.countPrices(pl.id)).toBe(0);
		});

		it("removing one product does not affect other products", async () => {
			const pl = await createTestPriceList();
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-2",
				price: 20,
			});

			await controller.removePrice(pl.id, "prod-1");

			expect(await controller.countPrices(pl.id)).toBe(1);
			const remaining = await controller.getPrice(pl.id, "prod-2");
			expect(remaining).not.toBeNull();
			expect(remaining?.price).toBe(20);
		});

		it("removing non-existent product is idempotent", async () => {
			const pl = await createTestPriceList();
			const first = await controller.removePrice(pl.id, "ghost");
			const second = await controller.removePrice(pl.id, "ghost");
			expect(first).toBe(false);
			expect(second).toBe(false);
		});
	});

	// ── resolvePrice — priority and filtering interactions ───────────

	describe("resolvePrice — priority and filtering interactions", () => {
		it("higher priority (lower number) list wins even with higher price", async () => {
			const highPriority = await createTestPriceList({
				slug: "high",
				priority: 0,
				status: "active",
			});
			const lowPriority = await createTestPriceList({
				slug: "low",
				priority: 10,
				status: "active",
			});

			await controller.setPrice({
				priceListId: highPriority.id,
				productId: "prod-1",
				price: 50,
			});
			await controller.setPrice({
				priceListId: lowPriority.id,
				productId: "prod-1",
				price: 5,
			});

			// First matching list by priority wins, regardless of actual price
			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved?.price).toBe(50);
			expect(resolved?.priceListId).toBe(highPriority.id);
		});

		it("skips lists outside their date window", async () => {
			const futureList = await createTestPriceList({
				slug: "future",
				status: "active",
				priority: 0,
				startsAt: new Date(Date.now() + 86400000),
				endsAt: new Date(Date.now() + 172800000),
			});
			const currentList = await createTestPriceList({
				slug: "current",
				status: "active",
				priority: 10,
				startsAt: new Date(Date.now() - 86400000),
				endsAt: new Date(Date.now() + 86400000),
			});

			await controller.setPrice({
				priceListId: futureList.id,
				productId: "prod-1",
				price: 1,
			});
			await controller.setPrice({
				priceListId: currentList.id,
				productId: "prod-1",
				price: 15,
			});

			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved?.price).toBe(15);
			expect(resolved?.priceListId).toBe(currentList.id);
		});

		it("excludes customer-group-specific lists when no group provided", async () => {
			const vipList = await createTestPriceList({
				slug: "vip",
				status: "active",
				priority: 0,
				customerGroupId: "vip-group",
			});
			await controller.setPrice({
				priceListId: vipList.id,
				productId: "prod-1",
				price: 5,
			});

			// No customerGroupId param — should NOT see the VIP list
			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved).toBeNull();
		});

		it("customer group param includes both group-specific and general lists", async () => {
			const general = await createTestPriceList({
				slug: "general",
				status: "active",
				priority: 10,
			});
			const vip = await createTestPriceList({
				slug: "vip",
				status: "active",
				priority: 0,
				customerGroupId: "vip-group",
			});

			await controller.setPrice({
				priceListId: general.id,
				productId: "prod-1",
				price: 20,
			});
			await controller.setPrice({
				priceListId: vip.id,
				productId: "prod-1",
				price: 12,
			});

			// VIP customer sees VIP list (priority 0) first
			const resolved = await controller.resolvePrice("prod-1", {
				customerGroupId: "vip-group",
			});
			expect(resolved?.price).toBe(12);
			expect(resolved?.priceListId).toBe(vip.id);
		});

		it("mismatched customer group excludes list", async () => {
			const vipOnly = await createTestPriceList({
				slug: "vip-only",
				status: "active",
				customerGroupId: "vip-group",
			});
			await controller.setPrice({
				priceListId: vipOnly.id,
				productId: "prod-1",
				price: 5,
			});

			const resolved = await controller.resolvePrice("prod-1", {
				customerGroupId: "regular-group",
			});
			expect(resolved).toBeNull();
		});

		it("currency filter excludes mismatched currency lists", async () => {
			const usdList = await createTestPriceList({
				slug: "usd",
				status: "active",
				currency: "USD",
			});
			await controller.setPrice({
				priceListId: usdList.id,
				productId: "prod-1",
				price: 10,
			});

			const resolved = await controller.resolvePrice("prod-1", {
				currency: "EUR",
			});
			expect(resolved).toBeNull();
		});

		it("list without currency matches any currency filter", async () => {
			const noCurrency = await createTestPriceList({
				slug: "any-currency",
				status: "active",
			});
			await controller.setPrice({
				priceListId: noCurrency.id,
				productId: "prod-1",
				price: 15,
			});

			const resolved = await controller.resolvePrice("prod-1", {
				currency: "GBP",
			});
			expect(resolved).not.toBeNull();
			expect(resolved?.price).toBe(15);
		});

		it("picks lowest price among overlapping quantity tiers in same list", async () => {
			const pl = await createTestPriceList({ status: "active" });
			// Two tiers that both match quantity=15
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 12,
				minQuantity: 10,
				maxQuantity: 20,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 8,
				minQuantity: 5,
				maxQuantity: 50,
			});

			const resolved = await controller.resolvePrice("prod-1", {
				quantity: 15,
			});
			expect(resolved?.price).toBe(8);
		});

		it("no quantity param matches all entries including tiered", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 20,
				minQuantity: 100,
				maxQuantity: 999,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 50,
			});

			// Without quantity, matchesQuantityTier returns true for all
			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved).not.toBeNull();
			// Should pick lowest: 20
			expect(resolved?.price).toBe(20);
		});

		it("quantity below all tiers returns null", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
				minQuantity: 10,
				maxQuantity: 50,
			});

			const resolved = await controller.resolvePrice("prod-1", {
				quantity: 3,
			});
			expect(resolved).toBeNull();
		});

		it("quantity above all tiers returns null", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
				minQuantity: 1,
				maxQuantity: 9,
			});

			const resolved = await controller.resolvePrice("prod-1", {
				quantity: 100,
			});
			expect(resolved).toBeNull();
		});
	});

	// ── resolvePrices — bulk resolution ──────────────────────────────

	describe("resolvePrices — bulk resolution", () => {
		it("returns only products that have matching prices", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-3",
				price: 30,
			});

			const resolved = await controller.resolvePrices([
				"prod-1",
				"prod-2",
				"prod-3",
			]);
			expect(Object.keys(resolved)).toHaveLength(2);
			expect(resolved["prod-1"]?.price).toBe(10);
			expect(resolved["prod-2"]).toBeUndefined();
			expect(resolved["prod-3"]?.price).toBe(30);
		});

		it("applies params consistently across all products", async () => {
			const vipList = await createTestPriceList({
				slug: "vip",
				status: "active",
				customerGroupId: "vip",
			});
			const generalList = await createTestPriceList({
				slug: "general",
				status: "active",
			});

			await controller.setPrice({
				priceListId: vipList.id,
				productId: "prod-1",
				price: 5,
			});
			await controller.setPrice({
				priceListId: generalList.id,
				productId: "prod-2",
				price: 20,
			});

			// VIP customer should see both: VIP list + general list
			const vipResolved = await controller.resolvePrices(["prod-1", "prod-2"], {
				customerGroupId: "vip",
			});
			expect(vipResolved["prod-1"]?.price).toBe(5);
			expect(vipResolved["prod-2"]?.price).toBe(20);

			// Anonymous customer should only see general list
			const anonResolved = await controller.resolvePrices(["prod-1", "prod-2"]);
			expect(anonResolved["prod-1"]).toBeUndefined();
			expect(anonResolved["prod-2"]?.price).toBe(20);
		});

		it("empty product list returns empty result", async () => {
			const resolved = await controller.resolvePrices([]);
			expect(Object.keys(resolved)).toHaveLength(0);
		});
	});

	// ── Cascade delete ───────────────────────────────────────────────

	describe("cascade delete — cross-list isolation", () => {
		it("deleting a price list does not affect entries in other lists", async () => {
			const plA = await createTestPriceList({ slug: "list-a" });
			const plB = await createTestPriceList({ slug: "list-b" });

			await controller.setPrice({
				priceListId: plA.id,
				productId: "prod-1",
				price: 10,
			});
			await controller.setPrice({
				priceListId: plB.id,
				productId: "prod-1",
				price: 20,
			});

			await controller.deletePriceList(plA.id);

			expect(await controller.countPrices(plA.id)).toBe(0);
			expect(await controller.countPrices(plB.id)).toBe(1);

			const entry = await controller.getPrice(plB.id, "prod-1");
			expect(entry?.price).toBe(20);
		});

		it("deleting a list with many entries cleans up all of them", async () => {
			const pl = await createTestPriceList();
			const productIds = Array.from({ length: 15 }, (_, i) => `prod-${i}`);
			await controller.bulkSetPrices(
				pl.id,
				productIds.map((pid) => ({ productId: pid, price: 10 })),
			);
			expect(await controller.countPrices(pl.id)).toBe(15);

			await controller.deletePriceList(pl.id);

			expect(await controller.countPrices(pl.id)).toBe(0);
			expect(await controller.getPriceList(pl.id)).toBeNull();
		});

		it("double delete returns false the second time", async () => {
			const pl = await createTestPriceList();
			expect(await controller.deletePriceList(pl.id)).toBe(true);
			expect(await controller.deletePriceList(pl.id)).toBe(false);
		});
	});

	// ── updatePriceList — field clearing and preservation ────────────

	describe("updatePriceList — field interactions", () => {
		it("partial update does not lose other optional fields", async () => {
			const pl = await createTestPriceList({
				description: "Test desc",
				currency: "USD",
				customerGroupId: "grp-1",
				startsAt: new Date("2026-01-01"),
				endsAt: new Date("2026-12-31"),
			});

			const updated = await controller.updatePriceList(pl.id, {
				name: "New Name",
			});

			expect(updated?.name).toBe("New Name");
			expect(updated?.description).toBe("Test desc");
			expect(updated?.currency).toBe("USD");
			expect(updated?.customerGroupId).toBe("grp-1");
			expect(updated?.startsAt).toEqual(new Date("2026-01-01"));
			expect(updated?.endsAt).toEqual(new Date("2026-12-31"));
		});

		it("clearing one field does not clear others", async () => {
			const pl = await createTestPriceList({
				description: "Keep me",
				currency: "EUR",
				customerGroupId: "grp-1",
			});

			const updated = await controller.updatePriceList(pl.id, {
				currency: null,
			});

			expect(updated?.description).toBe("Keep me");
			expect(updated?.currency).toBeUndefined();
			expect(updated?.customerGroupId).toBe("grp-1");
		});

		it("clearing all optional fields at once", async () => {
			const pl = await createTestPriceList({
				description: "D",
				currency: "USD",
				customerGroupId: "grp",
				startsAt: new Date("2026-01-01"),
				endsAt: new Date("2026-12-31"),
			});

			const updated = await controller.updatePriceList(pl.id, {
				description: null,
				currency: null,
				customerGroupId: null,
				startsAt: null,
				endsAt: null,
			});

			expect(updated?.description).toBeUndefined();
			expect(updated?.currency).toBeUndefined();
			expect(updated?.customerGroupId).toBeUndefined();
			expect(updated?.startsAt).toBeUndefined();
			expect(updated?.endsAt).toBeUndefined();
			// Required fields remain
			expect(updated?.name).toBe("Wholesale");
			expect(updated?.status).toBe("active");
			expect(updated?.priority).toBe(0);
		});

		it("updating status does not affect priority", async () => {
			const pl = await createTestPriceList({ priority: 5 });
			const updated = await controller.updatePriceList(pl.id, {
				status: "inactive",
			});
			expect(updated?.status).toBe("inactive");
			expect(updated?.priority).toBe(5);
		});

		it("multiple sequential updates accumulate correctly", async () => {
			const pl = await createTestPriceList();

			await controller.updatePriceList(pl.id, { description: "Step 1" });
			await controller.updatePriceList(pl.id, { currency: "GBP" });
			const final = await controller.updatePriceList(pl.id, { priority: 99 });

			expect(final?.description).toBe("Step 1");
			expect(final?.currency).toBe("GBP");
			expect(final?.priority).toBe(99);
		});
	});

	// ── listPriceLists — combined filters ────────────────────────────

	describe("listPriceLists — combined filters", () => {
		it("filters by both status and customerGroupId", async () => {
			await createTestPriceList({
				slug: "a",
				status: "active",
				customerGroupId: "grp-1",
			});
			await createTestPriceList({
				slug: "b",
				status: "active",
				customerGroupId: "grp-2",
			});
			await createTestPriceList({
				slug: "c",
				status: "inactive",
				customerGroupId: "grp-1",
			});

			const results = await controller.listPriceLists({
				status: "active",
				customerGroupId: "grp-1",
			});
			expect(results).toHaveLength(1);
			expect(results[0].slug).toBe("a");
		});

		it("pagination with skip beyond total returns empty", async () => {
			await createTestPriceList({ slug: "a" });
			await createTestPriceList({ slug: "b" });

			const results = await controller.listPriceLists({ skip: 10, take: 5 });
			expect(results).toHaveLength(0);
		});

		it("returns empty array when no lists exist", async () => {
			const results = await controller.listPriceLists();
			expect(results).toHaveLength(0);
		});
	});

	// ── countPriceLists — combined filters ───────────────────────────

	describe("countPriceLists — combined filters", () => {
		it("counts with both status and customerGroupId filter", async () => {
			await createTestPriceList({
				slug: "a",
				status: "active",
				customerGroupId: "grp-1",
			});
			await createTestPriceList({
				slug: "b",
				status: "active",
				customerGroupId: "grp-1",
			});
			await createTestPriceList({
				slug: "c",
				status: "inactive",
				customerGroupId: "grp-1",
			});
			await createTestPriceList({
				slug: "d",
				status: "active",
				customerGroupId: "grp-2",
			});

			const count = await controller.countPriceLists({
				status: "active",
				customerGroupId: "grp-1",
			});
			expect(count).toBe(2);
		});

		it("returns 0 when no lists match", async () => {
			await createTestPriceList({ slug: "a", status: "active" });

			const count = await controller.countPriceLists({
				status: "scheduled",
			});
			expect(count).toBe(0);
		});
	});

	// ── getStats — complex scenarios ─────────────────────────────────

	describe("getStats — complex scenarios", () => {
		it("stats reflect deletions", async () => {
			const pl1 = await createTestPriceList({
				slug: "a",
				status: "active",
			});
			await createTestPriceList({ slug: "b", status: "inactive" });
			await controller.setPrice({
				priceListId: pl1.id,
				productId: "prod-1",
				price: 10,
			});

			let stats = await controller.getStats();
			expect(stats.totalPriceLists).toBe(2);
			expect(stats.activePriceLists).toBe(1);
			expect(stats.inactivePriceLists).toBe(1);
			expect(stats.totalEntries).toBe(1);
			expect(stats.priceListsWithEntries).toBe(1);

			await controller.deletePriceList(pl1.id);

			stats = await controller.getStats();
			expect(stats.totalPriceLists).toBe(1);
			expect(stats.activePriceLists).toBe(0);
			expect(stats.inactivePriceLists).toBe(1);
			expect(stats.totalEntries).toBe(0);
			expect(stats.priceListsWithEntries).toBe(0);
		});

		it("priceListsWithEntries counts distinct lists not entries", async () => {
			const pl = await createTestPriceList({ slug: "a", status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-2",
				price: 20,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-3",
				price: 30,
			});

			const stats = await controller.getStats();
			expect(stats.totalEntries).toBe(3);
			expect(stats.priceListsWithEntries).toBe(1);
		});

		it("stats after adding and removing entries", async () => {
			const pl = await createTestPriceList({ slug: "a", status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-2",
				price: 20,
			});

			await controller.removePrice(pl.id, "prod-1");

			const stats = await controller.getStats();
			expect(stats.totalEntries).toBe(1);
			expect(stats.priceListsWithEntries).toBe(1);
		});

		it("stats with all statuses represented", async () => {
			await createTestPriceList({ slug: "a", status: "active" });
			await createTestPriceList({ slug: "b", status: "active" });
			await createTestPriceList({ slug: "c", status: "inactive" });
			await createTestPriceList({ slug: "d", status: "scheduled" });
			await createTestPriceList({ slug: "e", status: "scheduled" });
			await createTestPriceList({ slug: "f", status: "scheduled" });

			const stats = await controller.getStats();
			expect(stats.totalPriceLists).toBe(6);
			expect(stats.activePriceLists).toBe(2);
			expect(stats.inactivePriceLists).toBe(1);
			expect(stats.scheduledPriceLists).toBe(3);
		});
	});

	// ── Price list lifecycle — status transitions ────────────────────

	describe("price list lifecycle — status transitions", () => {
		it("inactive list becomes visible in resolvePrice after reactivation", async () => {
			const pl = await createTestPriceList({ status: "inactive" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 5,
			});

			// Inactive — should not resolve
			let resolved = await controller.resolvePrice("prod-1");
			expect(resolved).toBeNull();

			// Reactivate
			await controller.updatePriceList(pl.id, { status: "active" });

			// Now should resolve
			resolved = await controller.resolvePrice("prod-1");
			expect(resolved).not.toBeNull();
			expect(resolved?.price).toBe(5);
		});

		it("deactivating a list stops it from being resolved", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});

			let resolved = await controller.resolvePrice("prod-1");
			expect(resolved?.price).toBe(10);

			await controller.updatePriceList(pl.id, { status: "inactive" });

			resolved = await controller.resolvePrice("prod-1");
			expect(resolved).toBeNull();
		});

		it("changing priority reorders resolution", async () => {
			const plA = await createTestPriceList({
				slug: "a",
				status: "active",
				priority: 0,
			});
			const plB = await createTestPriceList({
				slug: "b",
				status: "active",
				priority: 10,
			});

			await controller.setPrice({
				priceListId: plA.id,
				productId: "prod-1",
				price: 50,
			});
			await controller.setPrice({
				priceListId: plB.id,
				productId: "prod-1",
				price: 5,
			});

			// Initially A wins (priority 0)
			let resolved = await controller.resolvePrice("prod-1");
			expect(resolved?.priceListId).toBe(plA.id);

			// Swap priorities
			await controller.updatePriceList(plA.id, { priority: 20 });
			await controller.updatePriceList(plB.id, { priority: 0 });

			// Now B wins
			resolved = await controller.resolvePrice("prod-1");
			expect(resolved?.priceListId).toBe(plB.id);
		});
	});

	// ── Cross-method interactions ────────────────────────────────────

	describe("cross-method interactions", () => {
		it("getPriceListBySlug reflects slug update", async () => {
			const pl = await createTestPriceList({ slug: "old-slug" });
			await controller.updatePriceList(pl.id, { slug: "new-slug" });

			const byOld = await controller.getPriceListBySlug("old-slug");
			const byNew = await controller.getPriceListBySlug("new-slug");
			expect(byOld).toBeNull();
			expect(byNew?.id).toBe(pl.id);
		});

		it("price entries survive price list update", async () => {
			const pl = await createTestPriceList();
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});

			await controller.updatePriceList(pl.id, {
				name: "Updated Name",
				description: "Updated desc",
			});

			const entry = await controller.getPrice(pl.id, "prod-1");
			expect(entry).not.toBeNull();
			expect(entry?.price).toBe(10);

			const count = await controller.countPrices(pl.id);
			expect(count).toBe(1);
		});

		it("resolvePrice reflects updated price list name", async () => {
			const pl = await createTestPriceList({
				name: "Original",
				status: "active",
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});

			await controller.updatePriceList(pl.id, { name: "Renamed" });

			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved?.priceListName).toBe("Renamed");
		});

		it("resolvePrice returns compareAtPrice as null when entry has none", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});

			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved?.compareAtPrice).toBeNull();
		});

		it("resolvePrice returns compareAtPrice when entry has one", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
				compareAtPrice: 25,
			});

			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved?.compareAtPrice).toBe(25);
		});

		it("listPrices returns entries from correct list only", async () => {
			const plA = await createTestPriceList({ slug: "list-a" });
			const plB = await createTestPriceList({ slug: "list-b" });

			await controller.setPrice({
				priceListId: plA.id,
				productId: "prod-1",
				price: 10,
			});
			await controller.setPrice({
				priceListId: plA.id,
				productId: "prod-2",
				price: 20,
			});
			await controller.setPrice({
				priceListId: plB.id,
				productId: "prod-3",
				price: 30,
			});

			const entriesA = await controller.listPrices(plA.id);
			const entriesB = await controller.listPrices(plB.id);

			expect(entriesA).toHaveLength(2);
			expect(entriesB).toHaveLength(1);
		});
	});

	// ── resolvePrice — multiple lists with combined filters ──────────

	describe("resolvePrice — combined filter scenarios", () => {
		it("currency + customerGroupId both applied together", async () => {
			const usdVip = await createTestPriceList({
				slug: "usd-vip",
				status: "active",
				currency: "USD",
				customerGroupId: "vip",
				priority: 0,
			});
			const eurVip = await createTestPriceList({
				slug: "eur-vip",
				status: "active",
				currency: "EUR",
				customerGroupId: "vip",
				priority: 0,
			});
			const usdGeneral = await createTestPriceList({
				slug: "usd-general",
				status: "active",
				currency: "USD",
				priority: 10,
			});

			await controller.setPrice({
				priceListId: usdVip.id,
				productId: "prod-1",
				price: 8,
			});
			await controller.setPrice({
				priceListId: eurVip.id,
				productId: "prod-1",
				price: 7,
			});
			await controller.setPrice({
				priceListId: usdGeneral.id,
				productId: "prod-1",
				price: 12,
			});

			// VIP + USD should see usdVip
			const resolved = await controller.resolvePrice("prod-1", {
				currency: "USD",
				customerGroupId: "vip",
			});
			expect(resolved?.price).toBe(8);
			expect(resolved?.priceListId).toBe(usdVip.id);
		});

		it("quantity + currency combined", async () => {
			const pl = await createTestPriceList({
				status: "active",
				currency: "USD",
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
				minQuantity: 1,
				maxQuantity: 9,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 7,
				minQuantity: 10,
				maxQuantity: 99,
			});

			const resolved = await controller.resolvePrice("prod-1", {
				currency: "USD",
				quantity: 15,
			});
			expect(resolved?.price).toBe(7);

			// Wrong currency returns null
			const wrongCurrency = await controller.resolvePrice("prod-1", {
				currency: "EUR",
				quantity: 15,
			});
			expect(wrongCurrency).toBeNull();
		});
	});

	// ── Edge cases with dates ────────────────────────────────────────

	describe("date window edge cases", () => {
		it("list with only startsAt (no endsAt) is active if past start", async () => {
			const pl = await createTestPriceList({
				status: "active",
				startsAt: new Date(Date.now() - 86400000),
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});

			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved).not.toBeNull();
			expect(resolved?.price).toBe(10);
		});

		it("list with only endsAt (no startsAt) is active if before end", async () => {
			const pl = await createTestPriceList({
				status: "active",
				endsAt: new Date(Date.now() + 86400000),
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});

			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved).not.toBeNull();
			expect(resolved?.price).toBe(10);
		});

		it("list with no dates is always active if status is active", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});

			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved).not.toBeNull();
		});

		it("expired list does not resolve even with active status", async () => {
			const pl = await createTestPriceList({
				status: "active",
				startsAt: new Date(Date.now() - 172800000),
				endsAt: new Date(Date.now() - 86400000),
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});

			const resolved = await controller.resolvePrice("prod-1");
			expect(resolved).toBeNull();
		});
	});

	// ── getPriceList / getPriceListBySlug — non-existent ─────────────

	describe("get methods — non-existent entities", () => {
		it("getPriceList returns null for deleted list", async () => {
			const pl = await createTestPriceList();
			await controller.deletePriceList(pl.id);
			expect(await controller.getPriceList(pl.id)).toBeNull();
		});

		it("getPriceListBySlug returns null for deleted list", async () => {
			const pl = await createTestPriceList({ slug: "to-delete" });
			await controller.deletePriceList(pl.id);
			expect(await controller.getPriceListBySlug("to-delete")).toBeNull();
		});

		it("getPrice returns null after removePrice", async () => {
			const pl = await createTestPriceList();
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});
			await controller.removePrice(pl.id, "prod-1");
			expect(await controller.getPrice(pl.id, "prod-1")).toBeNull();
		});

		it("getPrice returns null after parent list is deleted", async () => {
			const pl = await createTestPriceList();
			await controller.setPrice({
				priceListId: pl.id,
				productId: "prod-1",
				price: 10,
			});
			await controller.deletePriceList(pl.id);
			expect(await controller.getPrice(pl.id, "prod-1")).toBeNull();
		});
	});
});
