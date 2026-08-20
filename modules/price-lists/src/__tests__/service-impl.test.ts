import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPriceListController } from "../service-impl";

describe("createPriceListController", () => {
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
			slug: "wholesale",
			...overrides,
		});
	}

	async function createTestEntry(
		priceListId: string,
		overrides: Partial<Parameters<typeof controller.setPrice>[0]> = {},
	) {
		return controller.setPrice({
			priceListId,
			productId: "product-1",
			price: 9.99,
			...overrides,
		});
	}

	// ── createPriceList ──

	describe("createPriceList", () => {
		it("creates a price list with required fields", async () => {
			const pl = await createTestPriceList();
			expect(pl.id).toBeDefined();
			expect(pl.name).toBe("Wholesale");
			expect(pl.slug).toBe("wholesale");
			expect(pl.priority).toBe(0);
			expect(pl.status).toBe("active");
			expect(pl.createdAt).toBeInstanceOf(Date);
			expect(pl.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a price list with all optional fields", async () => {
			const startsAt = new Date("2026-04-01");
			const endsAt = new Date("2026-12-31");
			const pl = await createTestPriceList({
				description: "B2B wholesale prices",
				currency: "USD",
				priority: 5,
				status: "scheduled",
				startsAt,
				endsAt,
				customerGroupId: "group-vip",
			});
			expect(pl.description).toBe("B2B wholesale prices");
			expect(pl.currency).toBe("USD");
			expect(pl.priority).toBe(5);
			expect(pl.status).toBe("scheduled");
			expect(pl.startsAt).toEqual(startsAt);
			expect(pl.endsAt).toEqual(endsAt);
			expect(pl.customerGroupId).toBe("group-vip");
		});

		it("assigns unique IDs to each price list", async () => {
			const pl1 = await createTestPriceList({ slug: "a" });
			const pl2 = await createTestPriceList({ slug: "b" });
			expect(pl1.id).not.toBe(pl2.id);
		});
	});

	// ── getPriceList ──

	describe("getPriceList", () => {
		it("returns an existing price list by ID", async () => {
			const created = await createTestPriceList();
			const fetched = await controller.getPriceList(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.name).toBe("Wholesale");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getPriceList("missing");
			expect(result).toBeNull();
		});
	});

	// ── getPriceListBySlug ──

	describe("getPriceListBySlug", () => {
		it("returns a price list by slug", async () => {
			await createTestPriceList({ slug: "vip-pricing" });
			const result = await controller.getPriceListBySlug("vip-pricing");
			expect(result).not.toBeNull();
			expect(result?.slug).toBe("vip-pricing");
		});

		it("returns null for non-existent slug", async () => {
			const result = await controller.getPriceListBySlug("nope");
			expect(result).toBeNull();
		});
	});

	// ── updatePriceList ──

	describe("updatePriceList", () => {
		it("updates name and slug", async () => {
			const created = await createTestPriceList();
			const updated = await controller.updatePriceList(created.id, {
				name: "Retail",
				slug: "retail",
			});
			expect(updated).not.toBeNull();
			expect(updated?.name).toBe("Retail");
			expect(updated?.slug).toBe("retail");
		});

		it("clears optional fields with null", async () => {
			const created = await createTestPriceList({
				description: "Old desc",
				currency: "EUR",
				customerGroupId: "group-1",
			});
			const updated = await controller.updatePriceList(created.id, {
				description: null,
				currency: null,
				customerGroupId: null,
			});
			expect(updated).not.toBeNull();
			expect(updated?.description).toBeUndefined();
			expect(updated?.currency).toBeUndefined();
			expect(updated?.customerGroupId).toBeUndefined();
		});

		it("preserves fields not included in update", async () => {
			const created = await createTestPriceList({
				description: "Keep me",
				priority: 3,
			});
			const updated = await controller.updatePriceList(created.id, {
				name: "New Name",
			});
			expect(updated?.description).toBe("Keep me");
			expect(updated?.priority).toBe(3);
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.updatePriceList("missing", {
				name: "X",
			});
			expect(result).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await createTestPriceList();
			const updated = await controller.updatePriceList(created.id, {
				name: "Updated",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("updates schedule dates", async () => {
			const created = await createTestPriceList();
			const startsAt = new Date("2026-06-01");
			const endsAt = new Date("2026-06-30");
			const updated = await controller.updatePriceList(created.id, {
				startsAt,
				endsAt,
			});
			expect(updated?.startsAt).toEqual(startsAt);
			expect(updated?.endsAt).toEqual(endsAt);
		});

		it("clears schedule dates with null", async () => {
			const created = await createTestPriceList({
				startsAt: new Date("2026-01-01"),
				endsAt: new Date("2026-12-31"),
			});
			const updated = await controller.updatePriceList(created.id, {
				startsAt: null,
				endsAt: null,
			});
			expect(updated?.startsAt).toBeUndefined();
			expect(updated?.endsAt).toBeUndefined();
		});
	});

	// ── deletePriceList ──

	describe("deletePriceList", () => {
		it("deletes a price list and its entries", async () => {
			const pl = await createTestPriceList();
			await createTestEntry(pl.id, { productId: "p1" });
			await createTestEntry(pl.id, { productId: "p2" });

			const deleted = await controller.deletePriceList(pl.id);
			expect(deleted).toBe(true);

			const fetched = await controller.getPriceList(pl.id);
			expect(fetched).toBeNull();

			const entries = await controller.listPrices(pl.id);
			expect(entries).toHaveLength(0);
		});

		it("returns false for non-existent ID", async () => {
			const result = await controller.deletePriceList("missing");
			expect(result).toBe(false);
		});
	});

	// ── listPriceLists ──

	describe("listPriceLists", () => {
		it("returns all price lists", async () => {
			await createTestPriceList({ slug: "a" });
			await createTestPriceList({ slug: "b" });
			await createTestPriceList({ slug: "c" });

			const results = await controller.listPriceLists();
			expect(results).toHaveLength(3);
		});

		it("filters by status", async () => {
			await createTestPriceList({ slug: "a", status: "active" });
			await createTestPriceList({ slug: "b", status: "inactive" });
			await createTestPriceList({ slug: "c", status: "active" });

			const active = await controller.listPriceLists({ status: "active" });
			expect(active).toHaveLength(2);

			const inactive = await controller.listPriceLists({
				status: "inactive",
			});
			expect(inactive).toHaveLength(1);
		});

		it("filters by customerGroupId", async () => {
			await createTestPriceList({
				slug: "a",
				customerGroupId: "group-1",
			});
			await createTestPriceList({
				slug: "b",
				customerGroupId: "group-2",
			});
			await createTestPriceList({ slug: "c" });

			const results = await controller.listPriceLists({
				customerGroupId: "group-1",
			});
			expect(results).toHaveLength(1);
			expect(results[0].customerGroupId).toBe("group-1");
		});

		it("supports pagination", async () => {
			await createTestPriceList({ slug: "a" });
			await createTestPriceList({ slug: "b" });
			await createTestPriceList({ slug: "c" });

			const page = await controller.listPriceLists({ take: 2, skip: 0 });
			expect(page).toHaveLength(2);
		});
	});

	// ── countPriceLists ──

	describe("countPriceLists", () => {
		it("counts all price lists", async () => {
			await createTestPriceList({ slug: "a" });
			await createTestPriceList({ slug: "b" });

			const count = await controller.countPriceLists();
			expect(count).toBe(2);
		});

		it("counts filtered price lists", async () => {
			await createTestPriceList({ slug: "a", status: "active" });
			await createTestPriceList({ slug: "b", status: "inactive" });

			const count = await controller.countPriceLists({ status: "active" });
			expect(count).toBe(1);
		});
	});

	// ── setPrice ──

	describe("setPrice", () => {
		it("creates a new price entry", async () => {
			const pl = await createTestPriceList();
			const entry = await createTestEntry(pl.id);
			expect(entry.id).toBeDefined();
			expect(entry.priceListId).toBe(pl.id);
			expect(entry.productId).toBe("product-1");
			expect(entry.price).toBe(9.99);
			expect(entry.createdAt).toBeInstanceOf(Date);
		});

		it("creates an entry with compareAtPrice", async () => {
			const pl = await createTestPriceList();
			const entry = await createTestEntry(pl.id, {
				compareAtPrice: 19.99,
			});
			expect(entry.compareAtPrice).toBe(19.99);
		});

		it("creates an entry with quantity tiers", async () => {
			const pl = await createTestPriceList();
			const entry = await createTestEntry(pl.id, {
				minQuantity: 10,
				maxQuantity: 50,
			});
			expect(entry.minQuantity).toBe(10);
			expect(entry.maxQuantity).toBe(50);
		});

		it("upserts: updates existing entry for same product without quantity tier", async () => {
			const pl = await createTestPriceList();
			const first = await createTestEntry(pl.id, { price: 10 });
			const second = await createTestEntry(pl.id, { price: 8 });

			expect(second.id).toBe(first.id);
			expect(second.price).toBe(8);
		});

		it("creates separate entries for different quantity tiers", async () => {
			const pl = await createTestPriceList();
			const tier1 = await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 9.99,
				minQuantity: 1,
				maxQuantity: 9,
			});
			const tier2 = await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 7.99,
				minQuantity: 10,
				maxQuantity: 49,
			});

			expect(tier1.id).not.toBe(tier2.id);
			expect(tier1.price).toBe(9.99);
			expect(tier2.price).toBe(7.99);
		});

		it("creates separate entries for different products", async () => {
			const pl = await createTestPriceList();
			const e1 = await createTestEntry(pl.id, { productId: "p1" });
			const e2 = await createTestEntry(pl.id, { productId: "p2" });
			expect(e1.id).not.toBe(e2.id);
		});
	});

	// ── getPrice ──

	describe("getPrice", () => {
		it("returns an existing price entry", async () => {
			const pl = await createTestPriceList();
			await createTestEntry(pl.id);

			const entry = await controller.getPrice(pl.id, "product-1");
			expect(entry).not.toBeNull();
			expect(entry?.price).toBe(9.99);
		});

		it("returns null for non-existent entry", async () => {
			const pl = await createTestPriceList();
			const entry = await controller.getPrice(pl.id, "missing");
			expect(entry).toBeNull();
		});
	});

	// ── removePrice ──

	describe("removePrice", () => {
		it("removes all entries for a product in a price list", async () => {
			const pl = await createTestPriceList();
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 10,
				minQuantity: 1,
				maxQuantity: 9,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 8,
				minQuantity: 10,
				maxQuantity: 99,
			});

			const removed = await controller.removePrice(pl.id, "product-1");
			expect(removed).toBe(true);

			const entry = await controller.getPrice(pl.id, "product-1");
			expect(entry).toBeNull();
		});

		it("returns false for non-existent entry", async () => {
			const pl = await createTestPriceList();
			const removed = await controller.removePrice(pl.id, "missing");
			expect(removed).toBe(false);
		});
	});

	// ── listPrices ──

	describe("listPrices", () => {
		it("lists all entries for a price list", async () => {
			const pl = await createTestPriceList();
			await createTestEntry(pl.id, { productId: "p1" });
			await createTestEntry(pl.id, { productId: "p2" });
			await createTestEntry(pl.id, { productId: "p3" });

			const entries = await controller.listPrices(pl.id);
			expect(entries).toHaveLength(3);
		});

		it("supports pagination", async () => {
			const pl = await createTestPriceList();
			await createTestEntry(pl.id, { productId: "p1" });
			await createTestEntry(pl.id, { productId: "p2" });
			await createTestEntry(pl.id, { productId: "p3" });

			const page = await controller.listPrices(pl.id, {
				take: 2,
				skip: 0,
			});
			expect(page).toHaveLength(2);
		});

		it("returns empty array for price list with no entries", async () => {
			const pl = await createTestPriceList();
			const entries = await controller.listPrices(pl.id);
			expect(entries).toHaveLength(0);
		});
	});

	// ── countPrices ──

	describe("countPrices", () => {
		it("counts entries in a price list", async () => {
			const pl = await createTestPriceList();
			await createTestEntry(pl.id, { productId: "p1" });
			await createTestEntry(pl.id, { productId: "p2" });

			const count = await controller.countPrices(pl.id);
			expect(count).toBe(2);
		});

		it("returns 0 for price list with no entries", async () => {
			const pl = await createTestPriceList();
			const count = await controller.countPrices(pl.id);
			expect(count).toBe(0);
		});
	});

	// ── bulkSetPrices ──

	describe("bulkSetPrices", () => {
		it("sets prices for multiple products at once", async () => {
			const pl = await createTestPriceList();
			const entries = await controller.bulkSetPrices(pl.id, [
				{ productId: "p1", price: 10 },
				{ productId: "p2", price: 20 },
				{ productId: "p3", price: 30 },
			]);

			expect(entries).toHaveLength(3);
			expect(entries[0].productId).toBe("p1");
			expect(entries[0].price).toBe(10);
			expect(entries[1].productId).toBe("p2");
			expect(entries[1].price).toBe(20);
			expect(entries[2].productId).toBe("p3");
			expect(entries[2].price).toBe(30);
		});

		it("supports compareAtPrice in bulk", async () => {
			const pl = await createTestPriceList();
			const entries = await controller.bulkSetPrices(pl.id, [
				{ productId: "p1", price: 10, compareAtPrice: 15 },
				{ productId: "p2", price: 20, compareAtPrice: 25 },
			]);
			expect(entries[0].compareAtPrice).toBe(15);
			expect(entries[1].compareAtPrice).toBe(25);
		});

		it("supports quantity tiers in bulk", async () => {
			const pl = await createTestPriceList();
			const entries = await controller.bulkSetPrices(pl.id, [
				{ productId: "p1", price: 10, minQuantity: 1, maxQuantity: 9 },
				{
					productId: "p1",
					price: 8,
					minQuantity: 10,
					maxQuantity: 99,
				},
			]);
			expect(entries).toHaveLength(2);
			expect(entries[0].price).toBe(10);
			expect(entries[1].price).toBe(8);
		});

		it("upserts existing entries in bulk", async () => {
			const pl = await createTestPriceList();
			await controller.setPrice({
				priceListId: pl.id,
				productId: "p1",
				price: 50,
			});

			const entries = await controller.bulkSetPrices(pl.id, [
				{ productId: "p1", price: 40 },
			]);
			expect(entries).toHaveLength(1);
			expect(entries[0].price).toBe(40);

			const count = await controller.countPrices(pl.id);
			expect(count).toBe(1);
		});
	});

	// ── resolvePrice ──

	describe("resolvePrice", () => {
		it("resolves the best price from active price lists", async () => {
			const pl = await createTestPriceList({
				status: "active",
				priority: 0,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 7.99,
				compareAtPrice: 12.99,
			});

			const resolved = await controller.resolvePrice("product-1");
			expect(resolved).not.toBeNull();
			expect(resolved?.price).toBe(7.99);
			expect(resolved?.compareAtPrice).toBe(12.99);
			expect(resolved?.priceListId).toBe(pl.id);
			expect(resolved?.priceListName).toBe("Wholesale");
		});

		it("returns null when no price list has the product", async () => {
			await createTestPriceList({ status: "active" });
			const resolved = await controller.resolvePrice("missing-product");
			expect(resolved).toBeNull();
		});

		it("skips inactive price lists", async () => {
			const pl = await createTestPriceList({
				status: "inactive",
				slug: "inactive-list",
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 5,
			});

			const resolved = await controller.resolvePrice("product-1");
			expect(resolved).toBeNull();
		});

		it("uses priority to pick the first matching price list", async () => {
			const low = await createTestPriceList({
				slug: "low",
				priority: 0,
				status: "active",
			});
			const high = await createTestPriceList({
				slug: "high",
				priority: 10,
				status: "active",
			});

			await controller.setPrice({
				priceListId: low.id,
				productId: "product-1",
				price: 10,
			});
			await controller.setPrice({
				priceListId: high.id,
				productId: "product-1",
				price: 5,
			});

			const resolved = await controller.resolvePrice("product-1");
			expect(resolved?.price).toBe(10);
			expect(resolved?.priceListId).toBe(low.id);
		});

		it("filters by customer group", async () => {
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
				productId: "product-1",
				price: 20,
			});
			await controller.setPrice({
				priceListId: vip.id,
				productId: "product-1",
				price: 12,
			});

			// VIP customer sees the VIP price
			const vipPrice = await controller.resolvePrice("product-1", {
				customerGroupId: "vip-group",
			});
			expect(vipPrice?.price).toBe(12);
			expect(vipPrice?.priceListId).toBe(vip.id);

			// Regular customer only sees general list
			const regularPrice = await controller.resolvePrice("product-1");
			expect(regularPrice?.price).toBe(20);
			expect(regularPrice?.priceListId).toBe(general.id);
		});

		it("filters by currency", async () => {
			const usd = await createTestPriceList({
				slug: "usd",
				status: "active",
				currency: "USD",
			});
			const eur = await createTestPriceList({
				slug: "eur",
				status: "active",
				currency: "EUR",
			});

			await controller.setPrice({
				priceListId: usd.id,
				productId: "product-1",
				price: 10,
			});
			await controller.setPrice({
				priceListId: eur.id,
				productId: "product-1",
				price: 9,
			});

			const resolvedUsd = await controller.resolvePrice("product-1", {
				currency: "USD",
			});
			expect(resolvedUsd?.price).toBe(10);

			const resolvedEur = await controller.resolvePrice("product-1", {
				currency: "EUR",
			});
			expect(resolvedEur?.price).toBe(9);
		});

		it("respects quantity tiers", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 10,
				minQuantity: 1,
				maxQuantity: 9,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 7,
				minQuantity: 10,
				maxQuantity: 99,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 5,
				minQuantity: 100,
			});

			const qty1 = await controller.resolvePrice("product-1", {
				quantity: 5,
			});
			expect(qty1?.price).toBe(10);

			const qty10 = await controller.resolvePrice("product-1", {
				quantity: 25,
			});
			expect(qty10?.price).toBe(7);

			const qty100 = await controller.resolvePrice("product-1", {
				quantity: 150,
			});
			expect(qty100?.price).toBe(5);
		});

		it("returns null when quantity doesn't match any tier", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 10,
				minQuantity: 10,
				maxQuantity: 50,
			});

			const resolved = await controller.resolvePrice("product-1", {
				quantity: 5,
			});
			expect(resolved).toBeNull();
		});

		it("picks lowest price among matching entries in the same list", async () => {
			const pl = await createTestPriceList({ status: "active" });
			// Two entries that both match quantity of 15
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 12,
				minQuantity: 10,
				maxQuantity: 20,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 9,
				minQuantity: 5,
				maxQuantity: 50,
			});

			const resolved = await controller.resolvePrice("product-1", {
				quantity: 15,
			});
			expect(resolved?.price).toBe(9);
		});

		it("includes lists without currency restriction when filtering by currency", async () => {
			// Price list with no currency set should still match
			const any = await createTestPriceList({
				slug: "any-currency",
				status: "active",
			});
			await controller.setPrice({
				priceListId: any.id,
				productId: "product-1",
				price: 15,
			});

			const resolved = await controller.resolvePrice("product-1", {
				currency: "GBP",
			});
			expect(resolved).not.toBeNull();
			expect(resolved?.price).toBe(15);
		});

		it("returns compareAtPrice as null when not set", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 10,
			});

			const resolved = await controller.resolvePrice("product-1");
			expect(resolved?.compareAtPrice).toBeNull();
		});
	});

	// ── resolvePrices ──

	describe("resolvePrices", () => {
		it("resolves prices for multiple products", async () => {
			const pl = await createTestPriceList({ status: "active" });
			await controller.setPrice({
				priceListId: pl.id,
				productId: "p1",
				price: 10,
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "p2",
				price: 20,
			});

			const resolved = await controller.resolvePrices(["p1", "p2", "p3"]);
			expect(resolved.p1).toBeDefined();
			expect(resolved.p1.price).toBe(10);
			expect(resolved.p2).toBeDefined();
			expect(resolved.p2.price).toBe(20);
			expect(resolved.p3).toBeUndefined();
		});

		it("returns empty object when no prices match", async () => {
			const resolved = await controller.resolvePrices(["p1", "p2"]);
			expect(Object.keys(resolved)).toHaveLength(0);
		});

		it("passes params through to individual resolution", async () => {
			const pl = await createTestPriceList({
				status: "active",
				customerGroupId: "vip",
			});
			await controller.setPrice({
				priceListId: pl.id,
				productId: "p1",
				price: 5,
			});

			const withGroup = await controller.resolvePrices(["p1"], {
				customerGroupId: "vip",
			});
			expect(withGroup.p1).toBeDefined();
			expect(withGroup.p1.price).toBe(5);

			const withoutGroup = await controller.resolvePrices(["p1"]);
			expect(withoutGroup.p1).toBeUndefined();
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns stats for all price lists and entries", async () => {
			const pl1 = await createTestPriceList({
				slug: "a",
				status: "active",
			});
			const pl2 = await createTestPriceList({
				slug: "b",
				status: "inactive",
			});
			await createTestPriceList({ slug: "c", status: "scheduled" });

			await createTestEntry(pl1.id, { productId: "p1" });
			await createTestEntry(pl1.id, { productId: "p2" });
			await createTestEntry(pl2.id, { productId: "p3" });

			const stats = await controller.getStats();
			expect(stats.totalPriceLists).toBe(3);
			expect(stats.activePriceLists).toBe(1);
			expect(stats.inactivePriceLists).toBe(1);
			expect(stats.scheduledPriceLists).toBe(1);
			expect(stats.totalEntries).toBe(3);
			expect(stats.priceListsWithEntries).toBe(2);
		});

		it("returns zeros when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalPriceLists).toBe(0);
			expect(stats.activePriceLists).toBe(0);
			expect(stats.scheduledPriceLists).toBe(0);
			expect(stats.inactivePriceLists).toBe(0);
			expect(stats.totalEntries).toBe(0);
			expect(stats.priceListsWithEntries).toBe(0);
		});
	});

	// ── Cascading behavior ──

	describe("cascading behavior", () => {
		it("deleting a price list removes all its entries", async () => {
			const pl = await createTestPriceList();
			await createTestEntry(pl.id, { productId: "p1" });
			await createTestEntry(pl.id, { productId: "p2" });
			await createTestEntry(pl.id, { productId: "p3" });

			await controller.deletePriceList(pl.id);

			const count = await controller.countPrices(pl.id);
			expect(count).toBe(0);
		});

		it("entries from other price lists are not affected", async () => {
			const pl1 = await createTestPriceList({ slug: "a" });
			const pl2 = await createTestPriceList({ slug: "b" });

			await createTestEntry(pl1.id, { productId: "p1" });
			await createTestEntry(pl2.id, { productId: "p1" });

			await controller.deletePriceList(pl1.id);

			const remaining = await controller.countPrices(pl2.id);
			expect(remaining).toBe(1);
		});
	});

	// ── Price list lifecycle ──

	describe("price list lifecycle", () => {
		it("creates as active, updates to inactive, then back to active", async () => {
			const pl = await createTestPriceList({ status: "active" });
			expect(pl.status).toBe("active");

			const deactivated = await controller.updatePriceList(pl.id, {
				status: "inactive",
			});
			expect(deactivated?.status).toBe("inactive");

			const reactivated = await controller.updatePriceList(pl.id, {
				status: "active",
			});
			expect(reactivated?.status).toBe("active");
		});

		it("scheduled list becomes active when in date range", async () => {
			const past = new Date(Date.now() - 86400000);
			const future = new Date(Date.now() + 86400000);
			const pl = await createTestPriceList({
				status: "active",
				startsAt: past,
				endsAt: future,
			});

			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 5,
			});

			// Should resolve because we're within the date range
			const resolved = await controller.resolvePrice("product-1");
			expect(resolved).not.toBeNull();
			expect(resolved?.price).toBe(5);
		});

		it("scheduled list not active when before start date", async () => {
			const future = new Date(Date.now() + 86400000);
			const farFuture = new Date(Date.now() + 172800000);
			const pl = await createTestPriceList({
				status: "active",
				startsAt: future,
				endsAt: farFuture,
			});

			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 5,
			});

			// Should not resolve because start date is in the future
			const resolved = await controller.resolvePrice("product-1");
			expect(resolved).toBeNull();
		});

		it("scheduled list not active when after end date", async () => {
			const farPast = new Date(Date.now() - 172800000);
			const past = new Date(Date.now() - 86400000);
			const pl = await createTestPriceList({
				status: "active",
				startsAt: farPast,
				endsAt: past,
			});

			await controller.setPrice({
				priceListId: pl.id,
				productId: "product-1",
				price: 5,
			});

			// Should not resolve because end date is in the past
			const resolved = await controller.resolvePrice("product-1");
			expect(resolved).toBeNull();
		});
	});
});
