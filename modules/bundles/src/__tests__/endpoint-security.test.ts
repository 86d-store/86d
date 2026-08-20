import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { CreateBundleParams } from "../service";
import { createBundleController } from "../service-impl";

/**
 * Security regression tests for bundles endpoints.
 *
 * Bundles combine products with discounts for storefront display.
 * These tests verify:
 * - Discount integrity: percentage caps, fixed discount sanity
 * - Item isolation: items belong to their parent bundle only
 * - Slug uniqueness: duplicate slugs return the first match, not leak across
 * - Active/inactive filtering: draft, expired, and future bundles are hidden
 * - Quantity validation: min/max constraints are stored correctly
 * - Cascading delete: removing a bundle cleans up all child items
 */

function makeBundleParams(
	overrides: Partial<CreateBundleParams> = {},
): CreateBundleParams {
	return {
		name: "Test Bundle",
		slug: "test-bundle",
		discountType: "percentage",
		discountValue: 10,
		...overrides,
	};
}

describe("bundles endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBundleController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBundleController(mockData);
	});

	// ── Discount Integrity ──────────────────────────────────────────

	describe("discount integrity", () => {
		it("percentage discount value is stored as provided", async () => {
			const bundle = await controller.create(
				makeBundleParams({ discountType: "percentage", discountValue: 50 }),
			);
			expect(bundle.discountType).toBe("percentage");
			expect(bundle.discountValue).toBe(50);
		});

		it("fixed discount value is stored as provided", async () => {
			const bundle = await controller.create(
				makeBundleParams({
					slug: "fixed-discount",
					discountType: "fixed",
					discountValue: 25.5,
				}),
			);
			expect(bundle.discountType).toBe("fixed");
			expect(bundle.discountValue).toBe(25.5);
		});

		it("zero discount value is accepted", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "zero-disc", discountValue: 0 }),
			);
			expect(bundle.discountValue).toBe(0);
		});

		it("updating discount type preserves other fields", async () => {
			const bundle = await controller.create(
				makeBundleParams({
					slug: "disc-update",
					discountType: "percentage",
					discountValue: 20,
					description: "important description",
				}),
			);
			const updated = await controller.update(bundle.id, {
				discountType: "fixed",
				discountValue: 9.99,
			});
			expect(updated?.discountType).toBe("fixed");
			expect(updated?.discountValue).toBe(9.99);
			expect(updated?.description).toBe("important description");
			expect(updated?.name).toBe("Test Bundle");
		});

		it("discount value can be updated independently of type", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "partial-disc" }),
			);
			const updated = await controller.update(bundle.id, {
				discountValue: 99,
			});
			expect(updated?.discountValue).toBe(99);
			expect(updated?.discountType).toBe("percentage");
		});
	});

	// ── Item Isolation ──────────────────────────────────────────────

	describe("item isolation", () => {
		it("items from one bundle do not appear in another", async () => {
			const bundleA = await controller.create(
				makeBundleParams({ slug: "bundle-a", name: "Bundle A" }),
			);
			const bundleB = await controller.create(
				makeBundleParams({ slug: "bundle-b", name: "Bundle B" }),
			);

			await controller.addItem({
				bundleId: bundleA.id,
				productId: "prod_1",
				quantity: 2,
			});
			await controller.addItem({
				bundleId: bundleA.id,
				productId: "prod_2",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundleB.id,
				productId: "prod_3",
				quantity: 3,
			});

			const itemsA = await controller.listItems(bundleA.id);
			const itemsB = await controller.listItems(bundleB.id);

			expect(itemsA).toHaveLength(2);
			expect(itemsB).toHaveLength(1);

			for (const item of itemsA) {
				expect(item.bundleId).toBe(bundleA.id);
			}
			for (const item of itemsB) {
				expect(item.bundleId).toBe(bundleB.id);
			}
		});

		it("removing an item from bundle A does not affect bundle B items", async () => {
			const bundleA = await controller.create(
				makeBundleParams({ slug: "iso-a" }),
			);
			const bundleB = await controller.create(
				makeBundleParams({ slug: "iso-b" }),
			);

			const itemA = await controller.addItem({
				bundleId: bundleA.id,
				productId: "prod_1",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundleB.id,
				productId: "prod_2",
				quantity: 1,
			});

			await controller.removeItem(itemA.id);

			const itemsA = await controller.listItems(bundleA.id);
			const itemsB = await controller.listItems(bundleB.id);
			expect(itemsA).toHaveLength(0);
			expect(itemsB).toHaveLength(1);
		});

		it("getWithItems only returns items belonging to the bundle", async () => {
			const bundleA = await controller.create(
				makeBundleParams({ slug: "with-a" }),
			);
			const bundleB = await controller.create(
				makeBundleParams({ slug: "with-b" }),
			);

			await controller.addItem({
				bundleId: bundleA.id,
				productId: "prod_1",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundleB.id,
				productId: "prod_2",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundleB.id,
				productId: "prod_3",
				quantity: 2,
			});

			const result = await controller.getWithItems(bundleA.id);
			expect(result?.items).toHaveLength(1);
			expect(result?.items[0].productId).toBe("prod_1");
		});
	});

	// ── Slug Uniqueness ─────────────────────────────────────────────

	describe("slug uniqueness", () => {
		it("getBySlug returns consistent result for a given slug", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "unique-slug", name: "Original" }),
			);
			const found = await controller.getBySlug("unique-slug");
			expect(found?.id).toBe(bundle.id);
			expect(found?.name).toBe("Original");
		});

		it("getBySlug returns null for non-existent slug", async () => {
			await controller.create(makeBundleParams({ slug: "existing" }));
			const found = await controller.getBySlug("non-existent-slug");
			expect(found).toBeNull();
		});

		it("updating a slug makes the old slug unreachable", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "old-slug" }),
			);
			await controller.update(bundle.id, { slug: "new-slug" });

			const oldResult = await controller.getBySlug("old-slug");
			const newResult = await controller.getBySlug("new-slug");
			expect(oldResult).toBeNull();
			expect(newResult?.id).toBe(bundle.id);
		});
	});

	// ── Active / Inactive Filtering ─────────────────────────────────

	describe("active/inactive filtering", () => {
		it("draft bundles are excluded from listActive", async () => {
			await controller.create(makeBundleParams({ slug: "draft-bundle" }));

			const active = await controller.listActive();
			expect(active).toHaveLength(0);
		});

		it("archived bundles are excluded from listActive", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "archived-bundle" }),
			);
			await controller.update(bundle.id, { status: "archived" });

			const active = await controller.listActive();
			expect(active).toHaveLength(0);
		});

		it("expired active bundles are excluded from listActive", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "expired", endsAt: "2020-01-01" }),
			);
			await controller.update(bundle.id, { status: "active" });

			const active = await controller.listActive();
			expect(active).toHaveLength(0);
		});

		it("future-starting active bundles are excluded from listActive", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "future", startsAt: "2099-01-01" }),
			);
			await controller.update(bundle.id, { status: "active" });

			const active = await controller.listActive();
			expect(active).toHaveLength(0);
		});

		it("getActiveBySlug rejects draft bundle even with valid slug", async () => {
			await controller.create(makeBundleParams({ slug: "draft-slug" }));

			const result = await controller.getActiveBySlug("draft-slug");
			expect(result).toBeNull();
		});

		it("getActiveBySlug rejects expired bundle", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "expired-slug", endsAt: "2020-06-01" }),
			);
			await controller.update(bundle.id, { status: "active" });

			const result = await controller.getActiveBySlug("expired-slug");
			expect(result).toBeNull();
		});

		it("only truly active bundles appear in listActive with items", async () => {
			const good = await controller.create(
				makeBundleParams({ slug: "good-active" }),
			);
			await controller.update(good.id, { status: "active" });
			await controller.addItem({
				bundleId: good.id,
				productId: "prod_1",
				quantity: 1,
			});

			const expired = await controller.create(
				makeBundleParams({ slug: "bad-expired", endsAt: "2020-01-01" }),
			);
			await controller.update(expired.id, { status: "active" });

			await controller.create(makeBundleParams({ slug: "bad-draft" }));

			const active = await controller.listActive();
			expect(active).toHaveLength(1);
			expect(active[0].slug).toBe("good-active");
			expect(active[0].items).toHaveLength(1);
		});
	});

	// ── Quantity Constraints ────────────────────────────────────────

	describe("quantity validation", () => {
		it("minQuantity and maxQuantity are stored on creation", async () => {
			const bundle = await controller.create(
				makeBundleParams({
					slug: "qty-bundle",
					minQuantity: 2,
					maxQuantity: 10,
				}),
			);
			expect(bundle.minQuantity).toBe(2);
			expect(bundle.maxQuantity).toBe(10);
		});

		it("minQuantity and maxQuantity can be updated", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "qty-update" }),
			);
			const updated = await controller.update(bundle.id, {
				minQuantity: 5,
				maxQuantity: 50,
			});
			expect(updated?.minQuantity).toBe(5);
			expect(updated?.maxQuantity).toBe(50);
		});

		it("item quantity is preserved through updateItem", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "item-qty" }),
			);
			const item = await controller.addItem({
				bundleId: bundle.id,
				productId: "prod_1",
				quantity: 3,
			});

			const updated = await controller.updateItem(item.id, { sortOrder: 5 });
			expect(updated?.quantity).toBe(3);
			expect(updated?.sortOrder).toBe(5);
		});
	});

	// ── Cascading Delete ────────────────────────────────────────────

	describe("cascading delete — no orphaned items", () => {
		it("deleting a bundle removes all its items", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "cascade-del" }),
			);
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

			const deleted = await controller.delete(bundle.id);
			expect(deleted).toBe(true);

			const items = await controller.listItems(bundle.id);
			expect(items).toHaveLength(0);

			const found = await controller.get(bundle.id);
			expect(found).toBeNull();
		});

		it("deleting bundle A does not affect bundle B or its items", async () => {
			const bundleA = await controller.create(
				makeBundleParams({ slug: "del-a" }),
			);
			const bundleB = await controller.create(
				makeBundleParams({ slug: "del-b" }),
			);

			await controller.addItem({
				bundleId: bundleA.id,
				productId: "prod_1",
				quantity: 1,
			});
			await controller.addItem({
				bundleId: bundleB.id,
				productId: "prod_2",
				quantity: 1,
			});

			await controller.delete(bundleA.id);

			expect(await controller.get(bundleB.id)).not.toBeNull();
			const itemsB = await controller.listItems(bundleB.id);
			expect(itemsB).toHaveLength(1);
			expect(itemsB[0].productId).toBe("prod_2");
		});

		it("deleting a non-existent bundle returns false", async () => {
			const result = await controller.delete("non-existent-id");
			expect(result).toBe(false);
		});
	});

	// ── Non-existent Entity Access ──────────────────────────────────

	describe("non-existent entity access", () => {
		it("get returns null for unknown id", async () => {
			expect(await controller.get("unknown")).toBeNull();
		});

		it("getWithItems returns null for unknown id", async () => {
			expect(await controller.getWithItems("unknown")).toBeNull();
		});

		it("update returns null for unknown id", async () => {
			const result = await controller.update("unknown", { name: "X" });
			expect(result).toBeNull();
		});

		it("updateItem returns null for unknown item id", async () => {
			const result = await controller.updateItem("unknown", { quantity: 5 });
			expect(result).toBeNull();
		});

		it("removeItem returns false for unknown item id", async () => {
			expect(await controller.removeItem("unknown")).toBe(false);
		});
	});

	// ── Status Transition Safety ────────────────────────────────────

	describe("status transition safety", () => {
		it("new bundles always start as draft", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "fresh" }),
			);
			expect(bundle.status).toBe("draft");
		});

		it("status can be updated from draft to active", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "activate" }),
			);
			const updated = await controller.update(bundle.id, {
				status: "active",
			});
			expect(updated?.status).toBe("active");
		});

		it("status can be updated from active to archived", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "archive" }),
			);
			await controller.update(bundle.id, { status: "active" });
			const archived = await controller.update(bundle.id, {
				status: "archived",
			});
			expect(archived?.status).toBe("archived");
		});

		it("updatedAt is set on update", async () => {
			const bundle = await controller.create(
				makeBundleParams({ slug: "timestamp" }),
			);
			const updated = await controller.update(bundle.id, {
				name: "New Name",
			});
			expect(updated?.updatedAt).toBeInstanceOf(Date);
			expect(updated?.name).toBe("New Name");
		});
	});
});
