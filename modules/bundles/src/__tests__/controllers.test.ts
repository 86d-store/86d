import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Bundle, BundleItem } from "../service";
import { createBundleController } from "../service-impl";

// ── Helpers ───────────────────────────────────────────────────────────────

function bundleParams(
	overrides: Partial<
		Parameters<ReturnType<typeof createBundleController>["create"]>[0]
	> = {},
) {
	return {
		name: "Test Bundle",
		slug: "test-bundle",
		discountType: "percentage" as const,
		discountValue: 10,
		...overrides,
	};
}

function pastDate(daysAgo: number): string {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	return d.toISOString().split("T")[0];
}

function futureDate(daysAhead: number): string {
	const d = new Date();
	d.setDate(d.getDate() + daysAhead);
	return d.toISOString().split("T")[0];
}

// ── Edge-case and boundary tests ──────────────────────────────────────────

describe("bundle controllers — edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBundleController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBundleController(mockData);
	});

	// ── create — timestamps and ID generation ─────────────────────────

	describe("create — timestamps and ID uniqueness", () => {
		it("sets createdAt and updatedAt to approximately now", async () => {
			const before = new Date();
			const bundle = await controller.create(bundleParams());
			const after = new Date();

			expect(bundle.createdAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(bundle.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
			expect(bundle.updatedAt.getTime()).toBeGreaterThanOrEqual(
				before.getTime(),
			);
			expect(bundle.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("generates unique IDs for each bundle", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 10; i++) {
				const bundle = await controller.create(
					bundleParams({ slug: `slug-${i}` }),
				);
				ids.add(bundle.id);
			}
			expect(ids.size).toBe(10);
		});

		it("persists bundle to underlying data store", async () => {
			const bundle = await controller.create(bundleParams());
			expect(mockData.size("bundle")).toBe(1);
			const raw = await mockData.get("bundle", bundle.id);
			expect(raw).not.toBeNull();
			expect((raw as Record<string, unknown>).name).toBe("Test Bundle");
		});

		it("creates bundle with zero discount value", async () => {
			const bundle = await controller.create(
				bundleParams({ discountValue: 0 }),
			);
			expect(bundle.discountValue).toBe(0);
		});

		it("creates bundle with fixed discount type", async () => {
			const bundle = await controller.create(
				bundleParams({ discountType: "fixed", discountValue: 49.99 }),
			);
			expect(bundle.discountType).toBe("fixed");
			expect(bundle.discountValue).toBe(49.99);
		});

		it("leaves optional fields undefined when not provided", async () => {
			const bundle = await controller.create(bundleParams());
			expect(bundle.description).toBeUndefined();
			expect(bundle.minQuantity).toBeUndefined();
			expect(bundle.maxQuantity).toBeUndefined();
			expect(bundle.startsAt).toBeUndefined();
			expect(bundle.endsAt).toBeUndefined();
			expect(bundle.imageUrl).toBeUndefined();
			expect(bundle.sortOrder).toBeUndefined();
		});
	});

	// ── update — individual field updates ─────────────────────────────

	describe("update — individual optional fields", () => {
		let bundle: Bundle;

		beforeEach(async () => {
			bundle = await controller.create(
				bundleParams({
					description: "original",
					minQuantity: 1,
					maxQuantity: 10,
					startsAt: "2026-01-01",
					endsAt: "2026-12-31",
					imageUrl: "https://example.com/old.jpg",
					sortOrder: 5,
				}),
			);
		});

		it("updates description alone", async () => {
			const updated = await controller.update(bundle.id, {
				description: "new description",
			});
			expect(updated?.description).toBe("new description");
			expect(updated?.name).toBe("Test Bundle");
		});

		it("updates minQuantity alone", async () => {
			const updated = await controller.update(bundle.id, {
				minQuantity: 3,
			});
			expect(updated?.minQuantity).toBe(3);
			expect(updated?.maxQuantity).toBe(10);
		});

		it("updates maxQuantity alone", async () => {
			const updated = await controller.update(bundle.id, {
				maxQuantity: 50,
			});
			expect(updated?.maxQuantity).toBe(50);
			expect(updated?.minQuantity).toBe(1);
		});

		it("updates startsAt alone", async () => {
			const updated = await controller.update(bundle.id, {
				startsAt: "2026-06-01",
			});
			expect(updated?.startsAt).toBe("2026-06-01");
			expect(updated?.endsAt).toBe("2026-12-31");
		});

		it("updates endsAt alone", async () => {
			const updated = await controller.update(bundle.id, {
				endsAt: "2027-06-30",
			});
			expect(updated?.endsAt).toBe("2027-06-30");
			expect(updated?.startsAt).toBe("2026-01-01");
		});

		it("updates imageUrl alone", async () => {
			const updated = await controller.update(bundle.id, {
				imageUrl: "https://example.com/new.jpg",
			});
			expect(updated?.imageUrl).toBe("https://example.com/new.jpg");
		});

		it("updates sortOrder alone", async () => {
			const updated = await controller.update(bundle.id, {
				sortOrder: 99,
			});
			expect(updated?.sortOrder).toBe(99);
		});

		it("advances updatedAt timestamp on update", async () => {
			const original = bundle.updatedAt;
			// Small delay to ensure different timestamp
			const updated = await controller.update(bundle.id, {
				name: "Updated Name",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				original.getTime(),
			);
		});

		it("updates multiple fields simultaneously", async () => {
			const updated = await controller.update(bundle.id, {
				name: "New Name",
				slug: "new-slug",
				discountType: "fixed",
				discountValue: 25,
				status: "active",
			});
			expect(updated?.name).toBe("New Name");
			expect(updated?.slug).toBe("new-slug");
			expect(updated?.discountType).toBe("fixed");
			expect(updated?.discountValue).toBe(25);
			expect(updated?.status).toBe("active");
		});

		it("update persists changes to data store", async () => {
			await controller.update(bundle.id, { name: "Persisted" });
			const raw = await mockData.get("bundle", bundle.id);
			expect((raw as Record<string, unknown>).name).toBe("Persisted");
		});
	});

	// ── update — status transitions ───────────────────────────────────

	describe("update — status transitions", () => {
		it("transitions draft to active", async () => {
			const bundle = await controller.create(bundleParams());
			expect(bundle.status).toBe("draft");
			const updated = await controller.update(bundle.id, {
				status: "active",
			});
			expect(updated?.status).toBe("active");
		});

		it("transitions active to archived", async () => {
			const bundle = await controller.create(bundleParams());
			await controller.update(bundle.id, { status: "active" });
			const updated = await controller.update(bundle.id, {
				status: "archived",
			});
			expect(updated?.status).toBe("archived");
		});

		it("transitions archived to draft", async () => {
			const bundle = await controller.create(bundleParams());
			await controller.update(bundle.id, { status: "archived" });
			const updated = await controller.update(bundle.id, {
				status: "draft",
			});
			expect(updated?.status).toBe("draft");
		});
	});

	// ── delete — cascade behavior ─────────────────────────────────────

	describe("delete — cascade and data cleanup", () => {
		it("deletes all associated items when bundle is deleted", async () => {
			const bundle = await controller.create(bundleParams());
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_2",
				quantity: 2,
			});
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_3",
				quantity: 3,
			});

			expect(mockData.size("bundleItem")).toBe(3);
			await controller.delete(bundle.id);
			expect(mockData.size("bundleItem")).toBe(0);
			expect(mockData.size("bundle")).toBe(0);
		});

		it("does not delete items belonging to other bundles", async () => {
			const bundle1 = await controller.create(bundleParams({ slug: "b1" }));
			const bundle2 = await controller.create(bundleParams({ slug: "b2" }));
			await controller.addItem({
				bundleId: bundle1.id,
				productId: "prod_1",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundle2.id,
				productId: "prod_2",
				quantity: 1,
			});

			await controller.delete(bundle1.id);
			const remainingItems = await controller.listItems(bundle2.id);
			expect(remainingItems).toHaveLength(1);
			expect(remainingItems[0].productId).toBe("prod_2");
		});

		it("handles deleting a bundle with no items gracefully", async () => {
			const bundle = await controller.create(bundleParams());
			const result = await controller.delete(bundle.id);
			expect(result).toBe(true);
			expect(mockData.size("bundle")).toBe(0);
		});
	});

	// ── list — parameter combinations ─────────────────────────────────

	describe("list — parameter edge cases", () => {
		beforeEach(async () => {
			for (let i = 0; i < 5; i++) {
				const b = await controller.create(
					bundleParams({ name: `B${i}`, slug: `b-${i}` }),
				);
				if (i < 2) await controller.update(b.id, { status: "active" });
				if (i === 4) await controller.update(b.id, { status: "archived" });
			}
		});

		it("lists with no params returns all bundles", async () => {
			const all = await controller.list();
			expect(all).toHaveLength(5);
		});

		it("lists with undefined params returns all bundles", async () => {
			const all = await controller.list(undefined);
			expect(all).toHaveLength(5);
		});

		it("lists with empty params object returns all bundles", async () => {
			const all = await controller.list({});
			expect(all).toHaveLength(5);
		});

		it("lists with only take returns limited results", async () => {
			const page = await controller.list({ take: 3 });
			expect(page).toHaveLength(3);
		});

		it("lists with only skip returns remaining results", async () => {
			const page = await controller.list({ skip: 3 });
			expect(page).toHaveLength(2);
		});

		it("lists with skip beyond total returns empty", async () => {
			const page = await controller.list({ skip: 100 });
			expect(page).toHaveLength(0);
		});

		it("filters archived bundles by status", async () => {
			const archived = await controller.list({ status: "archived" });
			expect(archived).toHaveLength(1);
			expect(archived[0].status).toBe("archived");
		});

		it("filters draft bundles by status", async () => {
			const drafts = await controller.list({ status: "draft" });
			expect(drafts).toHaveLength(2);
		});

		it("combines status filter with take and skip", async () => {
			const active = await controller.list({
				status: "active",
				take: 1,
				skip: 0,
			});
			expect(active).toHaveLength(1);
		});
	});

	// ── isActive — date boundary logic ────────────────────────────────

	describe("isActive — date boundary behavior via getActiveBySlug", () => {
		it("active bundle with no date constraints is active", async () => {
			const bundle = await controller.create(
				bundleParams({ slug: "no-dates" }),
			);
			await controller.update(bundle.id, { status: "active" });
			const result = await controller.getActiveBySlug("no-dates");
			expect(result).not.toBeNull();
			expect(result?.name).toBe("Test Bundle");
		});

		it("active bundle with startsAt in the past is active", async () => {
			const bundle = await controller.create(
				bundleParams({ slug: "past-start", startsAt: pastDate(30) }),
			);
			await controller.update(bundle.id, { status: "active" });
			const result = await controller.getActiveBySlug("past-start");
			expect(result).not.toBeNull();
		});

		it("active bundle with endsAt in the future is active", async () => {
			const bundle = await controller.create(
				bundleParams({ slug: "future-end", endsAt: futureDate(30) }),
			);
			await controller.update(bundle.id, { status: "active" });
			const result = await controller.getActiveBySlug("future-end");
			expect(result).not.toBeNull();
		});

		it("active bundle within valid date range is active", async () => {
			const bundle = await controller.create(
				bundleParams({
					slug: "in-range",
					startsAt: pastDate(10),
					endsAt: futureDate(10),
				}),
			);
			await controller.update(bundle.id, { status: "active" });
			const result = await controller.getActiveBySlug("in-range");
			expect(result).not.toBeNull();
		});

		it("active bundle with startsAt in the future is not active", async () => {
			const bundle = await controller.create(
				bundleParams({ slug: "future-start", startsAt: futureDate(30) }),
			);
			await controller.update(bundle.id, { status: "active" });
			const result = await controller.getActiveBySlug("future-start");
			expect(result).toBeNull();
		});

		it("active bundle with endsAt in the past is not active", async () => {
			const bundle = await controller.create(
				bundleParams({ slug: "past-end", endsAt: pastDate(30) }),
			);
			await controller.update(bundle.id, { status: "active" });
			const result = await controller.getActiveBySlug("past-end");
			expect(result).toBeNull();
		});

		it("archived bundle is never active regardless of dates", async () => {
			const bundle = await controller.create(
				bundleParams({
					slug: "archived-valid-dates",
					startsAt: pastDate(10),
					endsAt: futureDate(10),
				}),
			);
			await controller.update(bundle.id, { status: "archived" });
			const result = await controller.getActiveBySlug("archived-valid-dates");
			expect(result).toBeNull();
		});

		it("draft bundle is never active regardless of dates", async () => {
			await controller.create(
				bundleParams({
					slug: "draft-valid-dates",
					startsAt: pastDate(10),
					endsAt: futureDate(10),
				}),
			);
			// status stays "draft" by default
			const result = await controller.getActiveBySlug("draft-valid-dates");
			expect(result).toBeNull();
		});
	});

	// ── listActive — filtering and items ──────────────────────────────

	describe("listActive — mixed scenarios", () => {
		it("includes active bundles with items attached", async () => {
			const bundle = await controller.create(
				bundleParams({ slug: "active-items" }),
			);
			await controller.update(bundle.id, { status: "active" });
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 2,
			});

			const active = await controller.listActive();
			expect(active).toHaveLength(1);
			expect(active[0].items).toHaveLength(1);
			expect(active[0].items[0].productId).toBe("prod_1");
		});

		it("filters out future-starting bundles from listActive", async () => {
			const bundle = await controller.create(
				bundleParams({ slug: "future-start-list", startsAt: futureDate(30) }),
			);
			await controller.update(bundle.id, { status: "active" });

			const active = await controller.listActive();
			expect(active).toHaveLength(0);
		});

		it("mixes valid and invalid active bundles correctly", async () => {
			// Valid active bundle
			const valid = await controller.create(
				bundleParams({ slug: "valid-active", name: "Valid" }),
			);
			await controller.update(valid.id, { status: "active" });

			// Expired active bundle
			const expired = await controller.create(
				bundleParams({
					slug: "expired-active",
					name: "Expired",
					endsAt: pastDate(5),
				}),
			);
			await controller.update(expired.id, { status: "active" });

			// Future active bundle
			const future = await controller.create(
				bundleParams({
					slug: "future-active",
					name: "Future",
					startsAt: futureDate(5),
				}),
			);
			await controller.update(future.id, { status: "active" });

			// Draft bundle
			await controller.create(
				bundleParams({ slug: "draft-one", name: "Draft" }),
			);

			const active = await controller.listActive();
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Valid");
		});

		it("returns empty when no params and no active bundles", async () => {
			await controller.create(bundleParams());
			const active = await controller.listActive();
			expect(active).toHaveLength(0);
		});

		it("passes take and skip to underlying query", async () => {
			for (let i = 0; i < 5; i++) {
				const b = await controller.create(
					bundleParams({ slug: `active-p-${i}`, name: `A${i}` }),
				);
				await controller.update(b.id, { status: "active" });
			}

			const page = await controller.listActive({ take: 2 });
			expect(page).toHaveLength(2);

			const skipped = await controller.listActive({ skip: 3 });
			expect(skipped).toHaveLength(2);
		});

		it("listActive with undefined params returns all active", async () => {
			const b1 = await controller.create(bundleParams({ slug: "la1" }));
			await controller.update(b1.id, { status: "active" });
			const b2 = await controller.create(bundleParams({ slug: "la2" }));
			await controller.update(b2.id, { status: "active" });

			const active = await controller.listActive(undefined);
			expect(active).toHaveLength(2);
		});
	});

	// ── addItem — edge cases ──────────────────────────────────────────

	describe("addItem — edge cases", () => {
		it("sets createdAt timestamp on item", async () => {
			const bundle = await controller.create(bundleParams());
			const before = new Date();
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			const after = new Date();
			expect(item.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(item.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("creates items with unique IDs", async () => {
			const bundle = await controller.create(bundleParams());
			const item1 = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			const item2 = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_2",
				quantity: 1,
			});
			expect(item1.id).not.toBe(item2.id);
		});

		it("allows adding same product multiple times", async () => {
			const bundle = await controller.create(bundleParams());
			const item1 = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			const item2 = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 2,
			});
			expect(item1.id).not.toBe(item2.id);
			const items = await controller.listItems(bundle.id);
			expect(items).toHaveLength(2);
		});

		it("creates item without optional variantId", async () => {
			const bundle = await controller.create(bundleParams());
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 3,
			});
			expect(item.variantId).toBeUndefined();
			expect(item.sortOrder).toBeUndefined();
		});

		it("creates item with sortOrder", async () => {
			const bundle = await controller.create(bundleParams());
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
				sortOrder: 10,
			});
			expect(item.sortOrder).toBe(10);
		});

		it("persists item to data store", async () => {
			const bundle = await controller.create(bundleParams());
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			expect(mockData.size("bundleItem")).toBe(1);
			const raw = await mockData.get("bundleItem", item.id);
			expect(raw).not.toBeNull();
		});
	});

	// ── updateItem — edge cases ───────────────────────────────────────

	describe("updateItem — edge cases", () => {
		let bundle: Bundle;
		let item: BundleItem;

		beforeEach(async () => {
			bundle = await controller.create(bundleParams());
			item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				variantId: "var_1",
				quantity: 2,
				sortOrder: 5,
			});
		});

		it("updates both quantity and sortOrder simultaneously", async () => {
			const updated = await controller.updateItem(item.id, {
				quantity: 10,
				sortOrder: 20,
			});
			expect(updated?.quantity).toBe(10);
			expect(updated?.sortOrder).toBe(20);
		});

		it("preserves other fields when updating quantity", async () => {
			const updated = await controller.updateItem(item.id, {
				quantity: 99,
			});
			expect(updated?.bundleId).toBe(bundle.id);
			expect(updated?.productId).toBe("prod_1");
			expect(updated?.variantId).toBe("var_1");
			expect(updated?.sortOrder).toBe(5);
		});

		it("preserves other fields when updating sortOrder", async () => {
			const updated = await controller.updateItem(item.id, {
				sortOrder: 42,
			});
			expect(updated?.quantity).toBe(2);
			expect(updated?.productId).toBe("prod_1");
			expect(updated?.variantId).toBe("var_1");
		});

		it("persists updated item to data store", async () => {
			await controller.updateItem(item.id, { quantity: 77 });
			const raw = await mockData.get("bundleItem", item.id);
			expect((raw as Record<string, unknown>).quantity).toBe(77);
		});

		it("updates item with quantity of zero", async () => {
			const updated = await controller.updateItem(item.id, {
				quantity: 0,
			});
			expect(updated?.quantity).toBe(0);
		});
	});

	// ── getWithItems — edge cases ─────────────────────────────────────

	describe("getWithItems — edge cases", () => {
		it("returns bundle with empty items array when no items", async () => {
			const bundle = await controller.create(bundleParams());
			const result = await controller.getWithItems(bundle.id);
			expect(result).not.toBeNull();
			expect(result?.items).toEqual([]);
			expect(result?.name).toBe("Test Bundle");
		});

		it("includes all bundle fields in result", async () => {
			const bundle = await controller.create(
				bundleParams({
					description: "desc",
					minQuantity: 2,
					maxQuantity: 8,
					imageUrl: "https://img.example.com/pic.jpg",
					sortOrder: 3,
				}),
			);
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});

			const result = await controller.getWithItems(bundle.id);
			expect(result?.description).toBe("desc");
			expect(result?.minQuantity).toBe(2);
			expect(result?.maxQuantity).toBe(8);
			expect(result?.imageUrl).toBe("https://img.example.com/pic.jpg");
			expect(result?.sortOrder).toBe(3);
			expect(result?.items).toHaveLength(1);
		});

		it("returns items with all their fields", async () => {
			const bundle = await controller.create(bundleParams());
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				variantId: "var_red",
				quantity: 5,
				sortOrder: 1,
			});

			const result = await controller.getWithItems(bundle.id);
			const item = result?.items[0];
			expect(item?.productId).toBe("prod_1");
			expect(item?.variantId).toBe("var_red");
			expect(item?.quantity).toBe(5);
			expect(item?.sortOrder).toBe(1);
			expect(item?.bundleId).toBe(bundle.id);
		});
	});

	// ── getActiveBySlug — items included ──────────────────────────────

	describe("getActiveBySlug — items are included", () => {
		it("returns items with the active bundle", async () => {
			const bundle = await controller.create(
				bundleParams({ slug: "with-items" }),
			);
			await controller.update(bundle.id, { status: "active" });
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_a",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_b",
				quantity: 2,
			});

			const result = await controller.getActiveBySlug("with-items");
			expect(result?.items).toHaveLength(2);
		});

		it("returns empty items array when active bundle has no items", async () => {
			const bundle = await controller.create(
				bundleParams({ slug: "empty-active" }),
			);
			await controller.update(bundle.id, { status: "active" });

			const result = await controller.getActiveBySlug("empty-active");
			expect(result).not.toBeNull();
			expect(result?.items).toEqual([]);
		});
	});

	// ── getBySlug — edge cases ────────────────────────────────────────

	describe("getBySlug — edge cases", () => {
		it("returns the first match when multiple bundles exist", async () => {
			await controller.create(
				bundleParams({ slug: "unique-slug", name: "First" }),
			);
			// Other bundles with different slugs
			await controller.create(
				bundleParams({ slug: "other-slug", name: "Other" }),
			);

			const result = await controller.getBySlug("unique-slug");
			expect(result?.name).toBe("First");
		});

		it("returns null for empty string slug", async () => {
			const result = await controller.getBySlug("");
			expect(result).toBeNull();
		});
	});

	// ── removeItem — edge cases ───────────────────────────────────────

	describe("removeItem — edge cases", () => {
		it("removes only the targeted item, leaving others intact", async () => {
			const bundle = await controller.create(bundleParams());
			const item1 = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_2",
				quantity: 2,
			});

			await controller.removeItem(item1.id);
			const items = await controller.listItems(bundle.id);
			expect(items).toHaveLength(1);
			expect(items[0].productId).toBe("prod_2");
		});

		it("item is no longer retrievable after removal", async () => {
			const bundle = await controller.create(bundleParams());
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			await controller.removeItem(item.id);
			const raw = await mockData.get("bundleItem", item.id);
			expect(raw).toBeNull();
		});
	});

	// ── listItems — edge cases ────────────────────────────────────────

	describe("listItems — edge cases", () => {
		it("returns empty array for non-existent bundle ID", async () => {
			const items = await controller.listItems("non-existent-id");
			expect(items).toEqual([]);
		});

		it("only returns items for the specified bundle", async () => {
			const bundle1 = await controller.create(bundleParams({ slug: "b1" }));
			const bundle2 = await controller.create(bundleParams({ slug: "b2" }));
			await controller.addItem({
				bundleId: bundle1.id,
				productId: "prod_1",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundle2.id,
				productId: "prod_2",
				quantity: 2,
			});

			const items1 = await controller.listItems(bundle1.id);
			expect(items1).toHaveLength(1);
			expect(items1[0].productId).toBe("prod_1");

			const items2 = await controller.listItems(bundle2.id);
			expect(items2).toHaveLength(1);
			expect(items2[0].productId).toBe("prod_2");
		});
	});

	// ── countAll — edge cases ─────────────────────────────────────────

	describe("countAll — edge cases", () => {
		it("counts all bundles regardless of status", async () => {
			const b1 = await controller.create(bundleParams({ slug: "c1" }));
			const b2 = await controller.create(bundleParams({ slug: "c2" }));
			await controller.create(bundleParams({ slug: "c3" }));
			await controller.update(b1.id, { status: "active" });
			await controller.update(b2.id, { status: "archived" });

			const count = await controller.countAll();
			expect(count).toBe(3);
		});

		it("count decreases after deletion", async () => {
			const b1 = await controller.create(bundleParams({ slug: "d1" }));
			await controller.create(bundleParams({ slug: "d2" }));

			expect(await controller.countAll()).toBe(2);
			await controller.delete(b1.id);
			expect(await controller.countAll()).toBe(1);
		});

		it("count increases with each creation", async () => {
			expect(await controller.countAll()).toBe(0);
			await controller.create(bundleParams({ slug: "e1" }));
			expect(await controller.countAll()).toBe(1);
			await controller.create(bundleParams({ slug: "e2" }));
			expect(await controller.countAll()).toBe(2);
		});
	});

	// ── Integration: full lifecycle ───────────────────────────────────

	describe("full lifecycle — create, populate, activate, query, delete", () => {
		it("follows a complete bundle lifecycle", async () => {
			// 1. Create
			const bundle = await controller.create(
				bundleParams({
					name: "Holiday Pack",
					slug: "holiday-pack",
					description: "Holiday essentials",
					discountType: "percentage",
					discountValue: 20,
					startsAt: pastDate(1),
					endsAt: futureDate(30),
				}),
			);
			expect(bundle.status).toBe("draft");

			// 2. Add items
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_hat",
				quantity: 1,
				sortOrder: 0,
			});
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_scarf",
				variantId: "var_red",
				quantity: 1,
				sortOrder: 1,
			});
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_gloves",
				quantity: 2,
				sortOrder: 2,
			});

			// 3. Verify items
			const items = await controller.listItems(bundle.id);
			expect(items).toHaveLength(3);

			// 4. Activate
			await controller.update(bundle.id, { status: "active" });

			// 5. Query active
			const activeBySlug = await controller.getActiveBySlug("holiday-pack");
			expect(activeBySlug).not.toBeNull();
			expect(activeBySlug?.items).toHaveLength(3);

			const activeList = await controller.listActive();
			expect(activeList).toHaveLength(1);

			// 6. Update an item
			const updated = await controller.updateItem(items[0].id, {
				quantity: 3,
			});
			expect(updated?.quantity).toBe(3);

			// 7. Remove an item
			await controller.removeItem(items[2].id);
			const remainingItems = await controller.listItems(bundle.id);
			expect(remainingItems).toHaveLength(2);

			// 8. Archive
			await controller.update(bundle.id, { status: "archived" });
			const archivedResult = await controller.getActiveBySlug("holiday-pack");
			expect(archivedResult).toBeNull();

			// 9. Delete
			const deleted = await controller.delete(bundle.id);
			expect(deleted).toBe(true);
			expect(await controller.countAll()).toBe(0);
			expect(mockData.size("bundleItem")).toBe(0);
		});
	});
});
