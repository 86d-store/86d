import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createProductLabelController } from "../service-impl";

describe("createProductLabelController", () => {
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
			name: "New Arrival",
			slug: "new-arrival",
			displayText: "New",
			type: "badge",
			...overrides,
		});
	}

	// --- createLabel ---

	describe("createLabel", () => {
		it("creates a label with required fields", async () => {
			const label = await createTestLabel();
			expect(label.id).toBeDefined();
			expect(label.name).toBe("New Arrival");
			expect(label.slug).toBe("new-arrival");
			expect(label.displayText).toBe("New");
			expect(label.type).toBe("badge");
			expect(label.isActive).toBe(true);
			expect(label.priority).toBe(0);
			expect(label.createdAt).toBeInstanceOf(Date);
			expect(label.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a label with all optional fields", async () => {
			const startsAt = new Date("2026-01-01");
			const endsAt = new Date("2026-12-31");
			const label = await createTestLabel({
				color: "#ffffff",
				backgroundColor: "#ef4444",
				icon: "Star",
				priority: 10,
				isActive: false,
				startsAt,
				endsAt,
				conditions: {
					newWithinDays: 30,
					discountMinPercent: 10,
				},
			});
			expect(label.color).toBe("#ffffff");
			expect(label.backgroundColor).toBe("#ef4444");
			expect(label.icon).toBe("Star");
			expect(label.priority).toBe(10);
			expect(label.isActive).toBe(false);
			expect(label.startsAt).toEqual(startsAt);
			expect(label.endsAt).toEqual(endsAt);
			expect(label.conditions).toEqual({
				newWithinDays: 30,
				discountMinPercent: 10,
			});
		});

		it("creates multiple labels with unique IDs", async () => {
			const label1 = await createTestLabel({ slug: "new-1" });
			const label2 = await createTestLabel({ slug: "sale-1", name: "Sale" });
			expect(label1.id).not.toBe(label2.id);
		});

		it("defaults isActive to true", async () => {
			const label = await createTestLabel();
			expect(label.isActive).toBe(true);
		});

		it("defaults priority to 0", async () => {
			const label = await createTestLabel();
			expect(label.priority).toBe(0);
		});
	});

	// --- getLabel ---

	describe("getLabel", () => {
		it("returns a label by ID", async () => {
			const created = await createTestLabel();
			const found = await controller.getLabel(created.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe("New Arrival");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getLabel("non-existent");
			expect(found).toBeNull();
		});
	});

	// --- getLabelBySlug ---

	describe("getLabelBySlug", () => {
		it("returns a label by slug", async () => {
			await createTestLabel();
			const found = await controller.getLabelBySlug("new-arrival");
			expect(found).not.toBeNull();
			expect(found?.name).toBe("New Arrival");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getLabelBySlug("non-existent");
			expect(found).toBeNull();
		});
	});

	// --- updateLabel ---

	describe("updateLabel", () => {
		it("updates label name", async () => {
			const created = await createTestLabel();
			const updated = await controller.updateLabel(created.id, {
				name: "Updated Name",
			});
			expect(updated?.name).toBe("Updated Name");
			expect(updated?.displayText).toBe("New");
		});

		it("updates label type and priority", async () => {
			const created = await createTestLabel();
			const updated = await controller.updateLabel(created.id, {
				type: "ribbon",
				priority: 5,
			});
			expect(updated?.type).toBe("ribbon");
			expect(updated?.priority).toBe(5);
		});

		it("clears optional date fields with null", async () => {
			const created = await createTestLabel({
				startsAt: new Date("2026-01-01"),
				endsAt: new Date("2026-12-31"),
			});
			const updated = await controller.updateLabel(created.id, {
				startsAt: null,
				endsAt: null,
			});
			expect(updated?.startsAt).toBeUndefined();
			expect(updated?.endsAt).toBeUndefined();
		});

		it("clears conditions with null", async () => {
			const created = await createTestLabel({
				conditions: { newWithinDays: 7 },
			});
			const updated = await controller.updateLabel(created.id, {
				conditions: null,
			});
			expect(updated?.conditions).toBeUndefined();
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.updateLabel("non-existent", {
				name: "X",
			});
			expect(result).toBeNull();
		});

		it("sets updatedAt to a new timestamp", async () => {
			const created = await createTestLabel();
			const updated = await controller.updateLabel(created.id, {
				name: "Updated",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});
	});

	// --- deleteLabel ---

	describe("deleteLabel", () => {
		it("deletes a label by ID", async () => {
			const created = await createTestLabel();
			const deleted = await controller.deleteLabel(created.id);
			expect(deleted).toBe(true);
			const found = await controller.getLabel(created.id);
			expect(found).toBeNull();
		});

		it("returns false for non-existent ID", async () => {
			const deleted = await controller.deleteLabel("non-existent");
			expect(deleted).toBe(false);
		});

		it("also removes product assignments when deleting a label", async () => {
			const label = await createTestLabel();
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			await controller.assignLabel({
				productId: "prod_2",
				labelId: label.id,
			});

			await controller.deleteLabel(label.id);

			const count = await controller.countProductsForLabel(label.id);
			expect(count).toBe(0);
		});
	});

	// --- listLabels ---

	describe("listLabels", () => {
		it("lists all labels", async () => {
			await createTestLabel({ slug: "new", name: "New" });
			await createTestLabel({ slug: "sale", name: "Sale" });
			await createTestLabel({ slug: "hot", name: "Hot" });

			const labels = await controller.listLabels();
			expect(labels.length).toBe(3);
		});

		it("filters by type", async () => {
			await createTestLabel({ slug: "badge-1", type: "badge" });
			await createTestLabel({ slug: "ribbon-1", type: "ribbon" });
			await createTestLabel({ slug: "tag-1", type: "tag" });

			const badges = await controller.listLabels({ type: "badge" });
			expect(badges.length).toBe(1);
			expect(badges[0].type).toBe("badge");
		});

		it("filters by active status", async () => {
			await createTestLabel({ slug: "active-1", isActive: true });
			await createTestLabel({ slug: "inactive-1", isActive: false });

			const active = await controller.listLabels({ isActive: true });
			expect(active.length).toBe(1);
			expect(active[0].isActive).toBe(true);
		});

		it("sorts by priority descending then name", async () => {
			await createTestLabel({
				slug: "low",
				name: "Low Priority",
				priority: 1,
			});
			await createTestLabel({
				slug: "high",
				name: "High Priority",
				priority: 10,
			});
			await createTestLabel({
				slug: "med",
				name: "Medium Priority",
				priority: 5,
			});

			const labels = await controller.listLabels();
			expect(labels[0].name).toBe("High Priority");
			expect(labels[1].name).toBe("Medium Priority");
			expect(labels[2].name).toBe("Low Priority");
		});

		it("respects take and skip", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestLabel({ slug: `label-${i}`, name: `Label ${i}` });
			}

			const page = await controller.listLabels({ take: 2, skip: 1 });
			expect(page.length).toBe(2);
		});
	});

	// --- countLabels ---

	describe("countLabels", () => {
		it("counts all labels", async () => {
			await createTestLabel({ slug: "a" });
			await createTestLabel({ slug: "b" });
			expect(await controller.countLabels()).toBe(2);
		});

		it("counts filtered labels", async () => {
			await createTestLabel({ slug: "active", isActive: true });
			await createTestLabel({ slug: "inactive", isActive: false });
			expect(await controller.countLabels({ isActive: true })).toBe(1);
		});
	});

	// --- assignLabel ---

	describe("assignLabel", () => {
		it("assigns a label to a product", async () => {
			const label = await createTestLabel();
			const assignment = await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			expect(assignment.id).toBeDefined();
			expect(assignment.productId).toBe("prod_1");
			expect(assignment.labelId).toBe(label.id);
			expect(assignment.assignedAt).toBeInstanceOf(Date);
		});

		it("assigns with a position", async () => {
			const label = await createTestLabel();
			const assignment = await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
				position: "top-left",
			});
			expect(assignment.position).toBe("top-left");
		});

		it("updates position on re-assignment", async () => {
			const label = await createTestLabel();
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
				position: "top-left",
			});
			const updated = await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
				position: "top-right",
			});
			expect(updated.position).toBe("top-right");

			// Should still only have one assignment
			const count = await controller.countProductsForLabel(label.id);
			expect(count).toBe(1);
		});

		it("throws for non-existent label", async () => {
			await expect(
				controller.assignLabel({
					productId: "prod_1",
					labelId: "non-existent",
				}),
			).rejects.toThrow("Label not found");
		});

		it("assigns multiple labels to same product", async () => {
			const label1 = await createTestLabel({ slug: "new" });
			const label2 = await createTestLabel({ slug: "sale" });

			await controller.assignLabel({
				productId: "prod_1",
				labelId: label1.id,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label2.id,
			});

			const result = await controller.getProductLabels("prod_1");
			expect(result.labels.length).toBe(2);
		});
	});

	// --- unassignLabel ---

	describe("unassignLabel", () => {
		it("removes a label from a product", async () => {
			const label = await createTestLabel();
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});

			const removed = await controller.unassignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			expect(removed).toBe(true);

			const result = await controller.getProductLabels("prod_1");
			expect(result.labels.length).toBe(0);
		});

		it("returns false for non-existent assignment", async () => {
			const removed = await controller.unassignLabel({
				productId: "prod_1",
				labelId: "non-existent",
			});
			expect(removed).toBe(false);
		});
	});

	// --- getProductLabels ---

	describe("getProductLabels", () => {
		it("returns labels for a product sorted by priority", async () => {
			const low = await createTestLabel({
				slug: "low",
				name: "Low",
				priority: 1,
			});
			const high = await createTestLabel({
				slug: "high",
				name: "High",
				priority: 10,
			});

			await controller.assignLabel({
				productId: "prod_1",
				labelId: low.id,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: high.id,
			});

			const result = await controller.getProductLabels("prod_1");
			expect(result.productId).toBe("prod_1");
			expect(result.labels.length).toBe(2);
			expect(result.labels[0].name).toBe("High");
			expect(result.labels[1].name).toBe("Low");
		});

		it("returns empty labels for product with no assignments", async () => {
			const result = await controller.getProductLabels("prod_99");
			expect(result.productId).toBe("prod_99");
			expect(result.labels).toEqual([]);
		});

		it("includes position from assignment", async () => {
			const label = await createTestLabel();
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
				position: "bottom-right",
			});

			const result = await controller.getProductLabels("prod_1");
			expect(result.labels[0].position).toBe("bottom-right");
		});
	});

	// --- getProductsForLabel ---

	describe("getProductsForLabel", () => {
		it("returns products assigned to a label", async () => {
			const label = await createTestLabel();
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			await controller.assignLabel({
				productId: "prod_2",
				labelId: label.id,
			});

			const products = await controller.getProductsForLabel({
				labelId: label.id,
			});
			expect(products.length).toBe(2);
		});

		it("returns all assigned products", async () => {
			const label = await createTestLabel();
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			await controller.assignLabel({
				productId: "prod_2",
				labelId: label.id,
			});

			const products = await controller.getProductsForLabel({
				labelId: label.id,
			});
			const productIds = products.map((p) => p.productId).sort();
			expect(productIds).toEqual(["prod_1", "prod_2"]);
		});

		it("respects take and skip", async () => {
			const label = await createTestLabel();
			for (let i = 0; i < 5; i++) {
				await controller.assignLabel({
					productId: `prod_${i}`,
					labelId: label.id,
				});
			}

			const page = await controller.getProductsForLabel({
				labelId: label.id,
				take: 2,
				skip: 1,
			});
			expect(page.length).toBe(2);
		});
	});

	// --- countProductsForLabel ---

	describe("countProductsForLabel", () => {
		it("counts products for a label", async () => {
			const label = await createTestLabel();
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			await controller.assignLabel({
				productId: "prod_2",
				labelId: label.id,
			});

			const count = await controller.countProductsForLabel(label.id);
			expect(count).toBe(2);
		});

		it("returns 0 for label with no products", async () => {
			const label = await createTestLabel();
			const count = await controller.countProductsForLabel(label.id);
			expect(count).toBe(0);
		});
	});

	// --- bulkAssignLabel ---

	describe("bulkAssignLabel", () => {
		it("assigns label to multiple products", async () => {
			const label = await createTestLabel();
			const assigned = await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2", "prod_3"],
				labelId: label.id,
			});
			expect(assigned).toBe(3);

			const count = await controller.countProductsForLabel(label.id);
			expect(count).toBe(3);
		});

		it("skips already-assigned products", async () => {
			const label = await createTestLabel();
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});

			const assigned = await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2"],
				labelId: label.id,
			});
			expect(assigned).toBe(1);
		});

		it("assigns with position", async () => {
			const label = await createTestLabel();
			await controller.bulkAssignLabel({
				productIds: ["prod_1"],
				labelId: label.id,
				position: "top-left",
			});

			const result = await controller.getProductLabels("prod_1");
			expect(result.labels[0].position).toBe("top-left");
		});

		it("throws for non-existent label", async () => {
			await expect(
				controller.bulkAssignLabel({
					productIds: ["prod_1"],
					labelId: "non-existent",
				}),
			).rejects.toThrow("Label not found");
		});
	});

	// --- bulkUnassignLabel ---

	describe("bulkUnassignLabel", () => {
		it("removes label from multiple products", async () => {
			const label = await createTestLabel();
			await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2", "prod_3"],
				labelId: label.id,
			});

			const removed = await controller.bulkUnassignLabel({
				productIds: ["prod_1", "prod_3"],
				labelId: label.id,
			});
			expect(removed).toBe(2);

			const count = await controller.countProductsForLabel(label.id);
			expect(count).toBe(1);
		});

		it("returns 0 for products not assigned", async () => {
			const label = await createTestLabel();
			const removed = await controller.bulkUnassignLabel({
				productIds: ["prod_1", "prod_2"],
				labelId: label.id,
			});
			expect(removed).toBe(0);
		});
	});

	// --- getActiveLabelsForProduct ---

	describe("getActiveLabelsForProduct", () => {
		it("returns only active labels", async () => {
			const active = await createTestLabel({
				slug: "active",
				isActive: true,
			});
			const inactive = await createTestLabel({
				slug: "inactive",
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
			expect(labels.length).toBe(1);
			expect(labels[0].slug).toBe("active");
		});

		it("excludes labels outside date range", async () => {
			const future = await createTestLabel({
				slug: "future",
				startsAt: new Date("2099-01-01"),
			});
			const expired = await createTestLabel({
				slug: "expired",
				endsAt: new Date("2020-01-01"),
			});
			const current = await createTestLabel({ slug: "current" });

			await controller.assignLabel({
				productId: "prod_1",
				labelId: future.id,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: expired.id,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: current.id,
			});

			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels.length).toBe(1);
			expect(labels[0].slug).toBe("current");
		});

		it("sorts by priority descending", async () => {
			const low = await createTestLabel({
				slug: "low",
				priority: 1,
			});
			const high = await createTestLabel({
				slug: "high",
				priority: 10,
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
			expect(labels[0].priority).toBe(10);
			expect(labels[1].priority).toBe(1);
		});

		it("returns empty array for product with no labels", async () => {
			const labels = await controller.getActiveLabelsForProduct("prod_99");
			expect(labels).toEqual([]);
		});
	});

	// --- getLabelStats ---

	describe("getLabelStats", () => {
		it("returns stats with product counts", async () => {
			const label1 = await createTestLabel({ slug: "new", name: "New" });
			const label2 = await createTestLabel({ slug: "sale", name: "Sale" });

			await controller.assignLabel({
				productId: "prod_1",
				labelId: label1.id,
			});
			await controller.assignLabel({
				productId: "prod_2",
				labelId: label1.id,
			});
			await controller.assignLabel({
				productId: "prod_3",
				labelId: label2.id,
			});

			const stats = await controller.getLabelStats();
			expect(stats.length).toBe(2);
			// Sorted by product count descending
			expect(stats[0].name).toBe("New");
			expect(stats[0].productCount).toBe(2);
			expect(stats[1].name).toBe("Sale");
			expect(stats[1].productCount).toBe(1);
		});

		it("includes labels with zero products", async () => {
			await createTestLabel({ slug: "empty" });
			const stats = await controller.getLabelStats();
			expect(stats.length).toBe(1);
			expect(stats[0].productCount).toBe(0);
		});

		it("respects take limit", async () => {
			for (let i = 0; i < 5; i++) {
				await createTestLabel({ slug: `label-${i}`, name: `Label ${i}` });
			}

			const stats = await controller.getLabelStats({ take: 2 });
			expect(stats.length).toBe(2);
		});

		it("includes label metadata", async () => {
			await createTestLabel({
				slug: "hot",
				name: "Hot",
				displayText: "Hot Deal",
				type: "ribbon",
			});

			const stats = await controller.getLabelStats();
			expect(stats[0].displayText).toBe("Hot Deal");
			expect(stats[0].type).toBe("ribbon");
			expect(stats[0].isActive).toBe(true);
		});
	});
});
