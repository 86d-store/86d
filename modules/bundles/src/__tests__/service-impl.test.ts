import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBundleController } from "../service-impl";

describe("createBundleController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBundleController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBundleController(mockData);
	});

	// ── create ───────────────────────────────────────────────────────────

	describe("create", () => {
		it("creates a bundle with required fields", async () => {
			const bundle = await controller.create({
				name: "Summer Kit",
				slug: "summer-kit",
				discountType: "percentage",
				discountValue: 15,
			});
			expect(bundle.id).toBeDefined();
			expect(bundle.name).toBe("Summer Kit");
			expect(bundle.slug).toBe("summer-kit");
			expect(bundle.discountType).toBe("percentage");
			expect(bundle.discountValue).toBe(15);
			expect(bundle.status).toBe("draft");
		});

		it("creates a bundle with optional fields", async () => {
			const bundle = await controller.create({
				name: "Complete Package",
				slug: "complete-package",
				description: "Everything you need",
				discountType: "fixed",
				discountValue: 49.99,
				minQuantity: 1,
				maxQuantity: 5,
				startsAt: "2026-01-01",
				endsAt: "2026-12-31",
				imageUrl: "https://example.com/image.jpg",
				sortOrder: 1,
			});
			expect(bundle.description).toBe("Everything you need");
			expect(bundle.discountType).toBe("fixed");
			expect(bundle.discountValue).toBe(49.99);
			expect(bundle.minQuantity).toBe(1);
			expect(bundle.maxQuantity).toBe(5);
			expect(bundle.startsAt).toBe("2026-01-01");
			expect(bundle.endsAt).toBe("2026-12-31");
			expect(bundle.imageUrl).toBe("https://example.com/image.jpg");
			expect(bundle.sortOrder).toBe(1);
		});

		it("defaults status to draft", async () => {
			const bundle = await controller.create({
				name: "Test",
				slug: "test",
				discountType: "percentage",
				discountValue: 10,
			});
			expect(bundle.status).toBe("draft");
		});
	});

	// ── get ──────────────────────────────────────────────────────────────

	describe("get", () => {
		it("returns an existing bundle", async () => {
			const created = await controller.create({
				name: "Bundle A",
				slug: "bundle-a",
				discountType: "percentage",
				discountValue: 10,
			});
			const found = await controller.get(created.id);
			expect(found?.id).toBe(created.id);
			expect(found?.name).toBe("Bundle A");
		});

		it("returns null for non-existent bundle", async () => {
			const found = await controller.get("missing");
			expect(found).toBeNull();
		});
	});

	// ── getBySlug ────────────────────────────────────────────────────────

	describe("getBySlug", () => {
		it("returns a bundle by slug", async () => {
			const bundle = await controller.create({
				name: "By Slug",
				slug: "by-slug",
				discountType: "fixed",
				discountValue: 29.99,
			});
			const found = await controller.getBySlug("by-slug");
			expect(found?.id).toBe(bundle.id);
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getBySlug("nope");
			expect(found).toBeNull();
		});
	});

	// ── list ─────────────────────────────────────────────────────────────

	describe("list", () => {
		it("lists all bundles", async () => {
			await controller.create({
				name: "A",
				slug: "a",
				discountType: "percentage",
				discountValue: 10,
			});
			await controller.create({
				name: "B",
				slug: "b",
				discountType: "percentage",
				discountValue: 20,
			});
			const all = await controller.list();
			expect(all).toHaveLength(2);
		});

		it("filters by status", async () => {
			const bundle = await controller.create({
				name: "Active",
				slug: "active",
				discountType: "percentage",
				discountValue: 10,
			});
			await controller.update(bundle.id, { status: "active" });
			await controller.create({
				name: "Draft",
				slug: "draft",
				discountType: "percentage",
				discountValue: 20,
			});

			const active = await controller.list({ status: "active" });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.create({
					name: `Bundle ${i}`,
					slug: `bundle-${i}`,
					discountType: "percentage",
					discountValue: i * 5,
				});
			}
			const page = await controller.list({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── update ───────────────────────────────────────────────────────────

	describe("update", () => {
		it("updates name and slug", async () => {
			const bundle = await controller.create({
				name: "Old Name",
				slug: "old-name",
				discountType: "percentage",
				discountValue: 10,
			});
			const updated = await controller.update(bundle.id, {
				name: "New Name",
				slug: "new-name",
			});
			expect(updated?.name).toBe("New Name");
			expect(updated?.slug).toBe("new-name");
		});

		it("updates status", async () => {
			const bundle = await controller.create({
				name: "Draft",
				slug: "draft",
				discountType: "percentage",
				discountValue: 10,
			});
			const updated = await controller.update(bundle.id, {
				status: "active",
			});
			expect(updated?.status).toBe("active");
		});

		it("updates discount", async () => {
			const bundle = await controller.create({
				name: "Test",
				slug: "test",
				discountType: "percentage",
				discountValue: 10,
			});
			const updated = await controller.update(bundle.id, {
				discountType: "fixed",
				discountValue: 39.99,
			});
			expect(updated?.discountType).toBe("fixed");
			expect(updated?.discountValue).toBe(39.99);
		});

		it("preserves fields not being updated", async () => {
			const bundle = await controller.create({
				name: "Preserved",
				slug: "preserved",
				description: "Keep me",
				discountType: "percentage",
				discountValue: 10,
			});
			const updated = await controller.update(bundle.id, {
				name: "Renamed",
			});
			expect(updated?.description).toBe("Keep me");
			expect(updated?.discountValue).toBe(10);
		});

		it("returns null for non-existent bundle", async () => {
			const result = await controller.update("missing", {
				name: "Nope",
			});
			expect(result).toBeNull();
		});
	});

	// ── delete ───────────────────────────────────────────────────────────

	describe("delete", () => {
		it("deletes a bundle and its items", async () => {
			const bundle = await controller.create({
				name: "Delete Me",
				slug: "delete-me",
				discountType: "percentage",
				discountValue: 10,
			});
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			const result = await controller.delete(bundle.id);
			expect(result).toBe(true);
			const found = await controller.get(bundle.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent bundle", async () => {
			const result = await controller.delete("missing");
			expect(result).toBe(false);
		});
	});

	// ── addItem ──────────────────────────────────────────────────────────

	describe("addItem", () => {
		it("adds an item to a bundle", async () => {
			const bundle = await controller.create({
				name: "With Items",
				slug: "with-items",
				discountType: "percentage",
				discountValue: 10,
			});
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 2,
			});
			expect(item.id).toBeDefined();
			expect(item.bundleId).toBe(bundle.id);
			expect(item.productId).toBe("prod_1");
			expect(item.quantity).toBe(2);
		});

		it("adds item with variant", async () => {
			const bundle = await controller.create({
				name: "Variants",
				slug: "variants",
				discountType: "percentage",
				discountValue: 10,
			});
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				variantId: "var_blue",
				quantity: 1,
				sortOrder: 0,
			});
			expect(item.variantId).toBe("var_blue");
			expect(item.sortOrder).toBe(0);
		});
	});

	// ── removeItem ───────────────────────────────────────────────────────

	describe("removeItem", () => {
		it("removes an item from a bundle", async () => {
			const bundle = await controller.create({
				name: "Remove Test",
				slug: "remove-test",
				discountType: "percentage",
				discountValue: 10,
			});
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			const result = await controller.removeItem(item.id);
			expect(result).toBe(true);
			const items = await controller.listItems(bundle.id);
			expect(items).toHaveLength(0);
		});

		it("returns false for non-existent item", async () => {
			const result = await controller.removeItem("missing");
			expect(result).toBe(false);
		});
	});

	// ── listItems ────────────────────────────────────────────────────────

	describe("listItems", () => {
		it("lists items for a bundle", async () => {
			const bundle = await controller.create({
				name: "Items List",
				slug: "items-list",
				discountType: "percentage",
				discountValue: 10,
			});
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_2",
				quantity: 3,
			});
			const items = await controller.listItems(bundle.id);
			expect(items).toHaveLength(2);
		});

		it("returns empty array for bundle with no items", async () => {
			const bundle = await controller.create({
				name: "Empty",
				slug: "empty",
				discountType: "percentage",
				discountValue: 10,
			});
			const items = await controller.listItems(bundle.id);
			expect(items).toHaveLength(0);
		});
	});

	// ── updateItem ───────────────────────────────────────────────────────

	describe("updateItem", () => {
		it("updates item quantity", async () => {
			const bundle = await controller.create({
				name: "Update Item",
				slug: "update-item",
				discountType: "percentage",
				discountValue: 10,
			});
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			const updated = await controller.updateItem(item.id, {
				quantity: 5,
			});
			expect(updated?.quantity).toBe(5);
		});

		it("updates item sortOrder", async () => {
			const bundle = await controller.create({
				name: "Sort Test",
				slug: "sort-test",
				discountType: "percentage",
				discountValue: 10,
			});
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});
			const updated = await controller.updateItem(item.id, {
				sortOrder: 3,
			});
			expect(updated?.sortOrder).toBe(3);
		});

		it("returns null for non-existent item", async () => {
			const result = await controller.updateItem("missing", {
				quantity: 5,
			});
			expect(result).toBeNull();
		});
	});

	// ── getWithItems ─────────────────────────────────────────────────────

	describe("getWithItems", () => {
		it("returns bundle with its items", async () => {
			const bundle = await controller.create({
				name: "With Items",
				slug: "with-items",
				discountType: "percentage",
				discountValue: 20,
			});
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
			const result = await controller.getWithItems(bundle.id);
			expect(result?.name).toBe("With Items");
			expect(result?.items).toHaveLength(2);
		});

		it("returns null for non-existent bundle", async () => {
			const result = await controller.getWithItems("missing");
			expect(result).toBeNull();
		});
	});

	// ── getActiveBySlug ──────────────────────────────────────────────────

	describe("getActiveBySlug", () => {
		it("returns active bundle with items by slug", async () => {
			const bundle = await controller.create({
				name: "Active Bundle",
				slug: "active-bundle",
				discountType: "percentage",
				discountValue: 15,
			});
			await controller.update(bundle.id, { status: "active" });
			await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 1,
			});

			const result = await controller.getActiveBySlug("active-bundle");
			expect(result?.name).toBe("Active Bundle");
			expect(result?.items).toHaveLength(1);
		});

		it("returns null for draft bundle", async () => {
			await controller.create({
				name: "Draft Bundle",
				slug: "draft-bundle",
				discountType: "percentage",
				discountValue: 10,
			});
			const result = await controller.getActiveBySlug("draft-bundle");
			expect(result).toBeNull();
		});

		it("returns null for expired bundle", async () => {
			const bundle = await controller.create({
				name: "Expired",
				slug: "expired",
				discountType: "percentage",
				discountValue: 10,
				endsAt: "2020-01-01",
			});
			await controller.update(bundle.id, { status: "active" });
			const result = await controller.getActiveBySlug("expired");
			expect(result).toBeNull();
		});

		it("returns null for future-starting bundle", async () => {
			const bundle = await controller.create({
				name: "Future",
				slug: "future",
				discountType: "percentage",
				discountValue: 10,
				startsAt: "2099-01-01",
			});
			await controller.update(bundle.id, { status: "active" });
			const result = await controller.getActiveBySlug("future");
			expect(result).toBeNull();
		});

		it("returns null for non-existent slug", async () => {
			const result = await controller.getActiveBySlug("nope");
			expect(result).toBeNull();
		});
	});

	// ── listActive ───────────────────────────────────────────────────────

	describe("listActive", () => {
		it("returns only currently active bundles", async () => {
			const b1 = await controller.create({
				name: "Active 1",
				slug: "active-1",
				discountType: "percentage",
				discountValue: 10,
			});
			await controller.update(b1.id, { status: "active" });

			const b2 = await controller.create({
				name: "Active 2",
				slug: "active-2",
				discountType: "percentage",
				discountValue: 20,
			});
			await controller.update(b2.id, { status: "active" });

			await controller.create({
				name: "Draft",
				slug: "draft",
				discountType: "percentage",
				discountValue: 30,
			});

			const active = await controller.listActive();
			expect(active).toHaveLength(2);
			expect(active[0].items).toBeDefined();
		});

		it("excludes expired bundles", async () => {
			const bundle = await controller.create({
				name: "Expired",
				slug: "expired-list",
				discountType: "percentage",
				discountValue: 10,
				endsAt: "2020-01-01",
			});
			await controller.update(bundle.id, { status: "active" });

			const active = await controller.listActive();
			expect(active).toHaveLength(0);
		});

		it("supports take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				const b = await controller.create({
					name: `Active ${i}`,
					slug: `active-${i}`,
					discountType: "percentage",
					discountValue: i * 5,
				});
				await controller.update(b.id, { status: "active" });
			}
			const page = await controller.listActive({ take: 2, skip: 1 });
			expect(page).toHaveLength(2);
		});
	});

	// ── countAll ─────────────────────────────────────────────────────────

	describe("countAll", () => {
		it("counts all bundles", async () => {
			await controller.create({
				name: "A",
				slug: "a",
				discountType: "percentage",
				discountValue: 10,
			});
			await controller.create({
				name: "B",
				slug: "b",
				discountType: "fixed",
				discountValue: 29.99,
			});
			await controller.create({
				name: "C",
				slug: "c",
				discountType: "percentage",
				discountValue: 5,
			});
			const count = await controller.countAll();
			expect(count).toBe(3);
		});

		it("returns 0 when no bundles exist", async () => {
			const count = await controller.countAll();
			expect(count).toBe(0);
		});
	});
});
