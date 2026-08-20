import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createProductLabelController } from "../service-impl";

/**
 * Endpoint-security tests for the product-labels module.
 *
 * These tests verify data-integrity and isolation invariants:
 *
 * 1. Slug/name uniqueness: duplicate slugs are stored but getLabelBySlug
 *    returns a deterministic first match
 * 2. Product assignment isolation: labels on one product do not leak to
 *    another; unassigning from one product leaves others intact
 * 3. Priority ordering integrity: labels are always returned sorted by
 *    priority descending, with alphabetical tiebreaker
 * 4. Active/inactive filtering: inactive labels are excluded from
 *    getActiveLabelsForProduct
 * 5. Date range enforcement: labels outside their startsAt/endsAt window
 *    are excluded from active queries
 * 6. Cascade delete: deleting a label removes all product assignments
 * 7. Bulk operation integrity: bulk assign/unassign counts are accurate
 *    and do not create duplicates
 */

describe("product-labels endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createProductLabelController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createProductLabelController(mockData);
	});

	async function createTestLabel(
		overrides: Partial<Parameters<typeof controller.createLabel>[0]> = {},
	) {
		return controller.createLabel({
			name: "Test Label",
			slug: "test-label",
			displayText: "Test",
			type: "badge",
			...overrides,
		});
	}

	// -- Slug Uniqueness --------------------------------------------------

	describe("slug uniqueness", () => {
		it("getLabelBySlug returns first match when duplicates exist", async () => {
			await createTestLabel({ slug: "sale", name: "First Sale" });
			await createTestLabel({ slug: "sale", name: "Second Sale" });

			const found = await controller.getLabelBySlug("sale");
			expect(found).not.toBeNull();
			expect(found?.name).toBe("First Sale");
		});

		it("two labels with same slug have distinct IDs", async () => {
			const a = await createTestLabel({ slug: "dup", name: "A" });
			const b = await createTestLabel({ slug: "dup", name: "B" });
			expect(a.id).not.toBe(b.id);
		});

		it("getLabelBySlug returns null for nonexistent slug", async () => {
			await createTestLabel({ slug: "exists" });
			const found = await controller.getLabelBySlug("does-not-exist");
			expect(found).toBeNull();
		});
	});

	// -- Product Assignment Isolation ------------------------------------

	describe("product assignment isolation", () => {
		it("labels assigned to product A do not appear on product B", async () => {
			const label = await createTestLabel({ slug: "exclusive" });
			await controller.assignLabel({
				productId: "prod_a",
				labelId: label.id,
			});

			const resultB = await controller.getProductLabels("prod_b");
			expect(resultB.labels).toHaveLength(0);
		});

		it("unassigning from product A does not affect product B", async () => {
			const label = await createTestLabel({ slug: "shared" });
			await controller.assignLabel({
				productId: "prod_a",
				labelId: label.id,
			});
			await controller.assignLabel({
				productId: "prod_b",
				labelId: label.id,
			});

			await controller.unassignLabel({
				productId: "prod_a",
				labelId: label.id,
			});

			const resultB = await controller.getProductLabels("prod_b");
			expect(resultB.labels).toHaveLength(1);
			expect(resultB.labels[0]?.slug).toBe("shared");
		});

		it("assigning same label twice to same product does not duplicate", async () => {
			const label = await createTestLabel({ slug: "no-dup" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
				position: "top-left",
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
				position: "top-right",
			});

			const count = await controller.countProductsForLabel(label.id);
			expect(count).toBe(1);
		});

		it("assigning to nonexistent label throws", async () => {
			await expect(
				controller.assignLabel({
					productId: "prod_1",
					labelId: "ghost-label",
				}),
			).rejects.toThrow("Label not found");
		});
	});

	// -- Priority Ordering Integrity ------------------------------------

	describe("priority ordering integrity", () => {
		it("listLabels returns highest priority first", async () => {
			await createTestLabel({
				slug: "low",
				name: "Low",
				priority: 1,
			});
			await createTestLabel({
				slug: "high",
				name: "High",
				priority: 100,
			});
			await createTestLabel({
				slug: "mid",
				name: "Mid",
				priority: 50,
			});

			const labels = await controller.listLabels();
			expect(labels[0]?.name).toBe("High");
			expect(labels[1]?.name).toBe("Mid");
			expect(labels[2]?.name).toBe("Low");
		});

		it("labels with equal priority sort alphabetically by name", async () => {
			await createTestLabel({
				slug: "z",
				name: "Zebra",
				priority: 5,
			});
			await createTestLabel({
				slug: "a",
				name: "Apple",
				priority: 5,
			});

			const labels = await controller.listLabels();
			expect(labels[0]?.name).toBe("Apple");
			expect(labels[1]?.name).toBe("Zebra");
		});

		it("getProductLabels sorts assigned labels by priority desc", async () => {
			const lo = await createTestLabel({
				slug: "lo",
				name: "Lo",
				priority: 0,
			});
			const hi = await createTestLabel({
				slug: "hi",
				name: "Hi",
				priority: 99,
			});

			await controller.assignLabel({
				productId: "prod_1",
				labelId: lo.id,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: hi.id,
			});

			const result = await controller.getProductLabels("prod_1");
			expect(result.labels[0]?.name).toBe("Hi");
			expect(result.labels[1]?.name).toBe("Lo");
		});

		it("getActiveLabelsForProduct respects priority order", async () => {
			const low = await createTestLabel({
				slug: "active-lo",
				priority: 2,
				isActive: true,
			});
			const high = await createTestLabel({
				slug: "active-hi",
				priority: 20,
				isActive: true,
			});

			await controller.assignLabel({
				productId: "prod_1",
				labelId: low.id,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: high.id,
			});

			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels[0]?.priority).toBe(20);
			expect(labels[1]?.priority).toBe(2);
		});
	});

	// -- Active / Inactive Filtering ------------------------------------

	describe("active/inactive filtering", () => {
		it("getActiveLabelsForProduct excludes inactive labels", async () => {
			const active = await createTestLabel({
				slug: "on",
				isActive: true,
			});
			const inactive = await createTestLabel({
				slug: "off",
				isActive: false,
			});

			await controller.assignLabel({
				productId: "prod_1",
				labelId: active.id,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: inactive.id,
			});

			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels).toHaveLength(1);
			expect(labels[0]?.slug).toBe("on");
		});

		it("deactivating a label removes it from active results", async () => {
			const label = await createTestLabel({
				slug: "toggle",
				isActive: true,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});

			// Verify visible while active
			let active = await controller.getActiveLabelsForProduct("prod_1");
			expect(active).toHaveLength(1);

			// Deactivate
			await controller.updateLabel(label.id, { isActive: false });

			active = await controller.getActiveLabelsForProduct("prod_1");
			expect(active).toHaveLength(0);
		});

		it("listLabels isActive filter correctly separates active and inactive", async () => {
			await createTestLabel({ slug: "a1", isActive: true });
			await createTestLabel({ slug: "a2", isActive: true });
			await createTestLabel({ slug: "i1", isActive: false });

			const activeList = await controller.listLabels({
				isActive: true,
			});
			const inactiveList = await controller.listLabels({
				isActive: false,
			});

			expect(activeList).toHaveLength(2);
			expect(inactiveList).toHaveLength(1);
			expect(inactiveList[0]?.slug).toBe("i1");
		});
	});

	// -- Date Range Enforcement -----------------------------------------

	describe("date range enforcement", () => {
		it("excludes labels that have not started yet", async () => {
			const futureLabel = await createTestLabel({
				slug: "future",
				isActive: true,
				startsAt: new Date("2099-06-01"),
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: futureLabel.id,
			});

			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels).toHaveLength(0);
		});

		it("excludes labels that have already ended", async () => {
			const expiredLabel = await createTestLabel({
				slug: "expired",
				isActive: true,
				endsAt: new Date("2020-01-01"),
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: expiredLabel.id,
			});

			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels).toHaveLength(0);
		});

		it("includes labels within a valid date window", async () => {
			const validLabel = await createTestLabel({
				slug: "valid-window",
				isActive: true,
				startsAt: new Date("2020-01-01"),
				endsAt: new Date("2099-12-31"),
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: validLabel.id,
			});

			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels).toHaveLength(1);
			expect(labels[0]?.slug).toBe("valid-window");
		});

		it("includes labels with no date constraints", async () => {
			const noDates = await createTestLabel({
				slug: "no-dates",
				isActive: true,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: noDates.id,
			});

			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels).toHaveLength(1);
		});

		it("clearing date constraints via update makes label active again", async () => {
			const label = await createTestLabel({
				slug: "was-expired",
				isActive: true,
				endsAt: new Date("2020-01-01"),
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});

			// Confirm excluded before fix
			let active = await controller.getActiveLabelsForProduct("prod_1");
			expect(active).toHaveLength(0);

			// Clear the expired date
			await controller.updateLabel(label.id, { endsAt: null });

			active = await controller.getActiveLabelsForProduct("prod_1");
			expect(active).toHaveLength(1);
		});
	});

	// -- Cascade Delete --------------------------------------------------

	describe("cascade delete integrity", () => {
		it("deleting a label removes all its product assignments", async () => {
			const label = await createTestLabel({ slug: "cascade" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			await controller.assignLabel({
				productId: "prod_2",
				labelId: label.id,
			});
			await controller.assignLabel({
				productId: "prod_3",
				labelId: label.id,
			});

			await controller.deleteLabel(label.id);

			expect(await controller.countProductsForLabel(label.id)).toBe(0);
			for (const pid of ["prod_1", "prod_2", "prod_3"]) {
				const result = await controller.getProductLabels(pid);
				expect(result.labels).toHaveLength(0);
			}
		});

		it("deleting label A does not remove label B assignments on the same product", async () => {
			const labelA = await createTestLabel({
				slug: "del-a",
				name: "A",
			});
			const labelB = await createTestLabel({
				slug: "keep-b",
				name: "B",
			});

			await controller.assignLabel({
				productId: "prod_1",
				labelId: labelA.id,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: labelB.id,
			});

			await controller.deleteLabel(labelA.id);

			const result = await controller.getProductLabels("prod_1");
			expect(result.labels).toHaveLength(1);
			expect(result.labels[0]?.name).toBe("B");
		});
	});

	// -- Bulk Operation Integrity ----------------------------------------

	describe("bulk operation integrity", () => {
		it("bulkAssignLabel skips already-assigned products", async () => {
			const label = await createTestLabel({ slug: "bulk-skip" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});

			const assigned = await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2", "prod_3"],
				labelId: label.id,
			});

			expect(assigned).toBe(2);
			expect(await controller.countProductsForLabel(label.id)).toBe(3);
		});

		it("bulkAssignLabel throws for nonexistent label", async () => {
			await expect(
				controller.bulkAssignLabel({
					productIds: ["prod_1"],
					labelId: "no-such-label",
				}),
			).rejects.toThrow("Label not found");
		});

		it("bulkUnassignLabel only removes targeted products", async () => {
			const label = await createTestLabel({ slug: "bulk-partial" });
			await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2", "prod_3"],
				labelId: label.id,
			});

			const removed = await controller.bulkUnassignLabel({
				productIds: ["prod_1", "prod_3"],
				labelId: label.id,
			});

			expect(removed).toBe(2);
			expect(await controller.countProductsForLabel(label.id)).toBe(1);

			const remaining = await controller.getProductLabels("prod_2");
			expect(remaining.labels).toHaveLength(1);
		});

		it("bulkUnassignLabel returns 0 for already-removed products", async () => {
			const label = await createTestLabel({
				slug: "bulk-no-ops",
			});
			const removed = await controller.bulkUnassignLabel({
				productIds: ["prod_x", "prod_y"],
				labelId: label.id,
			});
			expect(removed).toBe(0);
		});
	});

	// -- Label Stats Integrity -------------------------------------------

	describe("label stats integrity", () => {
		it("getLabelStats reflects accurate product counts after deletions", async () => {
			const label = await createTestLabel({ slug: "stats-del" });
			await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2", "prod_3"],
				labelId: label.id,
			});
			await controller.unassignLabel({
				productId: "prod_2",
				labelId: label.id,
			});

			const stats = await controller.getLabelStats();
			const entry = stats.find((s) => s.labelId === label.id);
			expect(entry?.productCount).toBe(2);
		});

		it("getLabelStats sorts by product count descending", async () => {
			const popular = await createTestLabel({
				slug: "popular",
				name: "Popular",
			});
			const sparse = await createTestLabel({
				slug: "sparse",
				name: "Sparse",
			});

			await controller.bulkAssignLabel({
				productIds: ["p1", "p2", "p3"],
				labelId: popular.id,
			});
			await controller.assignLabel({
				productId: "p1",
				labelId: sparse.id,
			});

			const stats = await controller.getLabelStats();
			expect(stats[0]?.name).toBe("Popular");
			expect(stats[0]?.productCount).toBe(3);
			expect(stats[1]?.name).toBe("Sparse");
			expect(stats[1]?.productCount).toBe(1);
		});
	});
});
