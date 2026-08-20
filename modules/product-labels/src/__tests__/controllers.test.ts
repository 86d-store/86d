import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createProductLabelController } from "../service-impl";

describe("ProductLabelController – edge cases", () => {
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

	// ── createLabel edge cases ──────────────────────────────────────────

	describe("createLabel – edge cases", () => {
		it("stores label with empty string name", async () => {
			const label = await createTestLabel({ name: "", slug: "empty-name" });
			expect(label.name).toBe("");
		});

		it("stores label with empty string displayText", async () => {
			const label = await createTestLabel({
				displayText: "",
				slug: "empty-display",
			});
			expect(label.displayText).toBe("");
		});

		it("stores label with negative priority", async () => {
			const label = await createTestLabel({
				slug: "neg-priority",
				priority: -5,
			});
			expect(label.priority).toBe(-5);
		});

		it("stores label with very large priority", async () => {
			const label = await createTestLabel({
				slug: "huge-priority",
				priority: Number.MAX_SAFE_INTEGER,
			});
			expect(label.priority).toBe(Number.MAX_SAFE_INTEGER);
		});

		it("stores label with zero priority explicitly", async () => {
			const label = await createTestLabel({
				slug: "zero-p",
				priority: 0,
			});
			expect(label.priority).toBe(0);
		});

		it("stores label with all six label types", async () => {
			const types = [
				"badge",
				"tag",
				"ribbon",
				"banner",
				"sticker",
				"custom",
			] as const;
			for (const type of types) {
				const label = await createTestLabel({
					slug: `type-${type}`,
					type,
				});
				expect(label.type).toBe(type);
			}
		});

		it("stores label where startsAt equals endsAt", async () => {
			const date = new Date("2026-06-15T12:00:00Z");
			const label = await createTestLabel({
				slug: "same-dates",
				startsAt: date,
				endsAt: date,
			});
			expect(label.startsAt).toEqual(label.endsAt);
		});

		it("stores label with conditions containing all fields", async () => {
			const label = await createTestLabel({
				slug: "full-conditions",
				conditions: {
					newWithinDays: 7,
					discountMinPercent: 20,
					lowStockThreshold: 3,
					categories: ["electronics", "sale"],
					priceMin: 1000,
					priceMax: 50000,
				},
			});
			expect(label.conditions?.newWithinDays).toBe(7);
			expect(label.conditions?.categories).toEqual(["electronics", "sale"]);
			expect(label.conditions?.priceMin).toBe(1000);
			expect(label.conditions?.priceMax).toBe(50000);
		});

		it("stores label with empty conditions object", async () => {
			const label = await createTestLabel({
				slug: "empty-cond",
				conditions: {},
			});
			expect(label.conditions).toEqual({});
		});

		it("stores label with conditions containing empty categories array", async () => {
			const label = await createTestLabel({
				slug: "empty-cats",
				conditions: { categories: [] },
			});
			expect(label.conditions?.categories).toEqual([]);
		});

		it("sets createdAt and updatedAt to the same value on creation", async () => {
			const label = await createTestLabel({ slug: "timestamp-check" });
			expect(label.createdAt.getTime()).toBe(label.updatedAt.getTime());
		});
	});

	// ── updateLabel edge cases ──────────────────────────────────────────

	describe("updateLabel – edge cases", () => {
		it("preserves fields not included in the update", async () => {
			const created = await createTestLabel({
				slug: "preserve-test",
				color: "#ff0000",
				backgroundColor: "#00ff00",
				icon: "Flame",
				priority: 5,
			});
			const updated = await controller.updateLabel(created.id, {
				name: "Updated Name Only",
			});
			expect(updated?.color).toBe("#ff0000");
			expect(updated?.backgroundColor).toBe("#00ff00");
			expect(updated?.icon).toBe("Flame");
			expect(updated?.priority).toBe(5);
			expect(updated?.slug).toBe("preserve-test");
		});

		it("updates with empty object preserves all existing values", async () => {
			const created = await createTestLabel({
				slug: "empty-update",
				name: "Original",
			});
			const updated = await controller.updateLabel(created.id, {});
			expect(updated?.name).toBe("Original");
			expect(updated?.slug).toBe("empty-update");
			expect(updated?.type).toBe("badge");
		});

		it("updates isActive from true to false", async () => {
			const created = await createTestLabel({
				slug: "deactivate",
				isActive: true,
			});
			const updated = await controller.updateLabel(created.id, {
				isActive: false,
			});
			expect(updated?.isActive).toBe(false);
		});

		it("updates label with new conditions replacing old ones", async () => {
			const created = await createTestLabel({
				slug: "replace-cond",
				conditions: { newWithinDays: 30 },
			});
			const updated = await controller.updateLabel(created.id, {
				conditions: { discountMinPercent: 50 },
			});
			expect(updated?.conditions).toEqual({ discountMinPercent: 50 });
			expect(updated?.conditions?.newWithinDays).toBeUndefined();
		});

		it("sets startsAt to a future date while leaving endsAt intact", async () => {
			const endsAt = new Date("2027-12-31");
			const created = await createTestLabel({
				slug: "partial-date-update",
				startsAt: new Date("2026-01-01"),
				endsAt,
			});
			const newStart = new Date("2026-06-01");
			const updated = await controller.updateLabel(created.id, {
				startsAt: newStart,
			});
			expect(updated?.startsAt).toEqual(newStart);
			expect(updated?.endsAt).toEqual(endsAt);
		});

		it("clears only startsAt with null while keeping endsAt", async () => {
			const endsAt = new Date("2027-12-31");
			const created = await createTestLabel({
				slug: "clear-start-only",
				startsAt: new Date("2026-01-01"),
				endsAt,
			});
			const updated = await controller.updateLabel(created.id, {
				startsAt: null,
			});
			expect(updated?.startsAt).toBeUndefined();
			expect(updated?.endsAt).toEqual(endsAt);
		});

		it("updates the same label twice in sequence", async () => {
			const created = await createTestLabel({ slug: "double-update" });
			await controller.updateLabel(created.id, { name: "First Update" });
			const second = await controller.updateLabel(created.id, {
				name: "Second Update",
			});
			expect(second?.name).toBe("Second Update");
		});

		it("persists update to the data store", async () => {
			const created = await createTestLabel({ slug: "persist-check" });
			await controller.updateLabel(created.id, { displayText: "Changed" });
			const fetched = await controller.getLabel(created.id);
			expect(fetched?.displayText).toBe("Changed");
		});
	});

	// ── deleteLabel edge cases ──────────────────────────────────────────

	describe("deleteLabel – edge cases", () => {
		it("deleting the same label twice returns false the second time", async () => {
			const label = await createTestLabel({ slug: "delete-twice" });
			expect(await controller.deleteLabel(label.id)).toBe(true);
			expect(await controller.deleteLabel(label.id)).toBe(false);
		});

		it("deleting a label does not affect other labels", async () => {
			const label1 = await createTestLabel({
				slug: "keep",
				name: "Keep",
			});
			const label2 = await createTestLabel({
				slug: "remove",
				name: "Remove",
			});
			await controller.deleteLabel(label2.id);
			const remaining = await controller.getLabel(label1.id);
			expect(remaining?.name).toBe("Keep");
		});

		it("deleting a label cleans up assignments for multiple products", async () => {
			const label = await createTestLabel({ slug: "multi-assign-del" });
			for (let i = 0; i < 5; i++) {
				await controller.assignLabel({
					productId: `prod_${i}`,
					labelId: label.id,
				});
			}
			await controller.deleteLabel(label.id);
			for (let i = 0; i < 5; i++) {
				const result = await controller.getProductLabels(`prod_${i}`);
				expect(result.labels.length).toBe(0);
			}
		});

		it("deleting a label does not remove assignments for other labels on the same product", async () => {
			const labelA = await createTestLabel({
				slug: "label-a",
				name: "A",
			});
			const labelB = await createTestLabel({
				slug: "label-b",
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
			expect(result.labels.length).toBe(1);
			expect(result.labels[0].name).toBe("B");
		});
	});

	// ── listLabels edge cases ───────────────────────────────────────────

	describe("listLabels – edge cases", () => {
		it("returns empty array when no labels exist", async () => {
			const labels = await controller.listLabels();
			expect(labels).toEqual([]);
		});

		it("returns empty array with no params argument", async () => {
			const labels = await controller.listLabels();
			expect(labels).toEqual([]);
		});

		it("sorts labels with same priority alphabetically by name", async () => {
			await createTestLabel({
				slug: "cherry",
				name: "Cherry",
				priority: 5,
			});
			await createTestLabel({
				slug: "apple",
				name: "Apple",
				priority: 5,
			});
			await createTestLabel({
				slug: "banana",
				name: "Banana",
				priority: 5,
			});
			const labels = await controller.listLabels();
			expect(labels[0].name).toBe("Apple");
			expect(labels[1].name).toBe("Banana");
			expect(labels[2].name).toBe("Cherry");
		});

		it("filters by type and isActive together", async () => {
			await createTestLabel({
				slug: "active-badge",
				type: "badge",
				isActive: true,
			});
			await createTestLabel({
				slug: "inactive-badge",
				type: "badge",
				isActive: false,
			});
			await createTestLabel({
				slug: "active-ribbon",
				type: "ribbon",
				isActive: true,
			});
			const result = await controller.listLabels({
				type: "badge",
				isActive: true,
			});
			expect(result.length).toBe(1);
			expect(result[0].slug).toBe("active-badge");
		});

		it("filters isActive=false correctly", async () => {
			await createTestLabel({
				slug: "active",
				isActive: true,
			});
			await createTestLabel({
				slug: "inactive",
				isActive: false,
			});
			const result = await controller.listLabels({ isActive: false });
			expect(result.length).toBe(1);
			expect(result[0].slug).toBe("inactive");
		});

		it("skip beyond total count returns empty array", async () => {
			await createTestLabel({ slug: "only-one" });
			const result = await controller.listLabels({ skip: 100 });
			expect(result).toEqual([]);
		});

		it("take of 0 returns empty array", async () => {
			await createTestLabel({ slug: "something" });
			const result = await controller.listLabels({ take: 0 });
			expect(result).toEqual([]);
		});
	});

	// ── countLabels edge cases ──────────────────────────────────────────

	describe("countLabels – edge cases", () => {
		it("returns 0 when no labels exist", async () => {
			expect(await controller.countLabels()).toBe(0);
		});

		it("returns 0 when filter matches nothing", async () => {
			await createTestLabel({ slug: "badge", type: "badge" });
			expect(await controller.countLabels({ type: "ribbon" })).toBe(0);
		});

		it("counts with both type and isActive filters", async () => {
			await createTestLabel({
				slug: "ab",
				type: "badge",
				isActive: true,
			});
			await createTestLabel({
				slug: "ib",
				type: "badge",
				isActive: false,
			});
			await createTestLabel({
				slug: "ar",
				type: "ribbon",
				isActive: true,
			});
			expect(
				await controller.countLabels({ type: "badge", isActive: true }),
			).toBe(1);
		});
	});

	// ── assignLabel edge cases ──────────────────────────────────────────

	describe("assignLabel – edge cases", () => {
		it("re-assigning without position clears previous position", async () => {
			const label = await createTestLabel({ slug: "pos-clear" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
				position: "top-left",
			});
			const updated = await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			expect(updated.position).toBeUndefined();
		});

		it("assigning the same label to different products creates separate assignments", async () => {
			const label = await createTestLabel({ slug: "multi-product" });
			const a1 = await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			const a2 = await controller.assignLabel({
				productId: "prod_2",
				labelId: label.id,
			});
			expect(a1.id).not.toBe(a2.id);
			expect(await controller.countProductsForLabel(label.id)).toBe(2);
		});

		it("assigns label with each valid position", async () => {
			const positions = [
				"top-left",
				"top-right",
				"bottom-left",
				"bottom-right",
				"center",
			] as const;
			const label = await createTestLabel({ slug: "all-positions" });
			for (let i = 0; i < positions.length; i++) {
				const assignment = await controller.assignLabel({
					productId: `prod_pos_${i}`,
					labelId: label.id,
					position: positions[i],
				});
				expect(assignment.position).toBe(positions[i]);
			}
		});

		it("re-assignment preserves the original assignedAt timestamp", async () => {
			const label = await createTestLabel({ slug: "ts-preserve" });
			const first = await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
				position: "top-left",
			});
			const second = await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
				position: "top-right",
			});
			expect(second.assignedAt).toEqual(first.assignedAt);
		});
	});

	// ── unassignLabel edge cases ────────────────────────────────────────

	describe("unassignLabel – edge cases", () => {
		it("unassigning a label from one product does not affect other products", async () => {
			const label = await createTestLabel({ slug: "unassign-isolation" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			await controller.assignLabel({
				productId: "prod_2",
				labelId: label.id,
			});
			await controller.unassignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			expect(await controller.countProductsForLabel(label.id)).toBe(1);
			const result = await controller.getProductLabels("prod_2");
			expect(result.labels.length).toBe(1);
		});

		it("unassigning a label leaves other labels on the same product intact", async () => {
			const labelA = await createTestLabel({ slug: "ua-a", name: "A" });
			const labelB = await createTestLabel({ slug: "ua-b", name: "B" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: labelA.id,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: labelB.id,
			});
			await controller.unassignLabel({
				productId: "prod_1",
				labelId: labelA.id,
			});
			const result = await controller.getProductLabels("prod_1");
			expect(result.labels.length).toBe(1);
			expect(result.labels[0].name).toBe("B");
		});

		it("unassigning twice returns false the second time", async () => {
			const label = await createTestLabel({ slug: "ua-twice" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			expect(
				await controller.unassignLabel({
					productId: "prod_1",
					labelId: label.id,
				}),
			).toBe(true);
			expect(
				await controller.unassignLabel({
					productId: "prod_1",
					labelId: label.id,
				}),
			).toBe(false);
		});
	});

	// ── getProductLabels edge cases ─────────────────────────────────────

	describe("getProductLabels – edge cases", () => {
		it("skips labels that were deleted from the data store", async () => {
			const label = await createTestLabel({ slug: "orphan-test" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			// Directly remove the label from the store but leave the assignment
			await mockData.delete("label", label.id);
			const result = await controller.getProductLabels("prod_1");
			expect(result.labels.length).toBe(0);
		});

		it("returns labels sorted by priority with mixed values", async () => {
			const low = await createTestLabel({
				slug: "low",
				name: "Low",
				priority: -10,
			});
			const mid = await createTestLabel({
				slug: "mid",
				name: "Mid",
				priority: 0,
			});
			const high = await createTestLabel({
				slug: "high",
				name: "High",
				priority: 100,
			});
			for (const label of [low, mid, high]) {
				await controller.assignLabel({
					productId: "prod_sort",
					labelId: label.id,
				});
			}
			const result = await controller.getProductLabels("prod_sort");
			expect(result.labels[0].name).toBe("High");
			expect(result.labels[1].name).toBe("Mid");
			expect(result.labels[2].name).toBe("Low");
		});
	});

	// ── getProductsForLabel edge cases ──────────────────────────────────

	describe("getProductsForLabel – edge cases", () => {
		it("returns empty array for a label with no products", async () => {
			const label = await createTestLabel({ slug: "no-products" });
			const products = await controller.getProductsForLabel({
				labelId: label.id,
			});
			expect(products).toEqual([]);
		});

		it("returns empty array for non-existent label id", async () => {
			const products = await controller.getProductsForLabel({
				labelId: "does-not-exist",
			});
			expect(products).toEqual([]);
		});

		it("skip beyond available returns empty array", async () => {
			const label = await createTestLabel({ slug: "skip-beyond" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			const products = await controller.getProductsForLabel({
				labelId: label.id,
				skip: 100,
			});
			expect(products).toEqual([]);
		});
	});

	// ── bulkAssignLabel edge cases ──────────────────────────────────────

	describe("bulkAssignLabel – edge cases", () => {
		it("assigns 0 when given an empty productIds array", async () => {
			const label = await createTestLabel({ slug: "bulk-empty" });
			const assigned = await controller.bulkAssignLabel({
				productIds: [],
				labelId: label.id,
			});
			expect(assigned).toBe(0);
		});

		it("does not double-count when all products are already assigned", async () => {
			const label = await createTestLabel({ slug: "bulk-all-exist" });
			await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2"],
				labelId: label.id,
			});
			const assigned = await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2"],
				labelId: label.id,
			});
			expect(assigned).toBe(0);
			expect(await controller.countProductsForLabel(label.id)).toBe(2);
		});

		it("counts only newly assigned products in a mixed set", async () => {
			const label = await createTestLabel({ slug: "bulk-mixed" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			const assigned = await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2", "prod_3"],
				labelId: label.id,
			});
			expect(assigned).toBe(2);
		});

		it("assigns with position to all new products", async () => {
			const label = await createTestLabel({ slug: "bulk-pos" });
			await controller.bulkAssignLabel({
				productIds: ["prod_1", "prod_2"],
				labelId: label.id,
				position: "bottom-left",
			});
			const r1 = await controller.getProductLabels("prod_1");
			const r2 = await controller.getProductLabels("prod_2");
			expect(r1.labels[0].position).toBe("bottom-left");
			expect(r2.labels[0].position).toBe("bottom-left");
		});
	});

	// ── bulkUnassignLabel edge cases ────────────────────────────────────

	describe("bulkUnassignLabel – edge cases", () => {
		it("returns 0 for empty productIds array", async () => {
			const label = await createTestLabel({ slug: "bulk-un-empty" });
			const removed = await controller.bulkUnassignLabel({
				productIds: [],
				labelId: label.id,
			});
			expect(removed).toBe(0);
		});

		it("returns 0 when none of the products are assigned", async () => {
			const label = await createTestLabel({ slug: "bulk-un-none" });
			const removed = await controller.bulkUnassignLabel({
				productIds: ["prod_x", "prod_y"],
				labelId: label.id,
			});
			expect(removed).toBe(0);
		});

		it("removes only the specified products", async () => {
			const label = await createTestLabel({ slug: "bulk-un-partial" });
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
			const result = await controller.getProductLabels("prod_2");
			expect(result.labels.length).toBe(1);
		});

		it("handles mix of assigned and non-assigned product ids", async () => {
			const label = await createTestLabel({ slug: "bulk-un-mix" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			const removed = await controller.bulkUnassignLabel({
				productIds: ["prod_1", "prod_nonexistent"],
				labelId: label.id,
			});
			expect(removed).toBe(1);
		});
	});

	// ── getActiveLabelsForProduct edge cases ────────────────────────────

	describe("getActiveLabelsForProduct – edge cases", () => {
		it("includes label whose startsAt is exactly now", async () => {
			const now = new Date();
			const label = await createTestLabel({
				slug: "starts-now",
				startsAt: now,
				isActive: true,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels.length).toBe(1);
		});

		it("includes label with no date constraints", async () => {
			const label = await createTestLabel({
				slug: "no-dates",
				isActive: true,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels.length).toBe(1);
		});

		it("excludes label whose startsAt is in the future", async () => {
			const label = await createTestLabel({
				slug: "future-only",
				startsAt: new Date("2099-01-01"),
				isActive: true,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels.length).toBe(0);
		});

		it("excludes label whose endsAt is in the past", async () => {
			const label = await createTestLabel({
				slug: "past-only",
				endsAt: new Date("2020-01-01"),
				isActive: true,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels.length).toBe(0);
		});

		it("includes label within valid date range", async () => {
			const label = await createTestLabel({
				slug: "in-range",
				startsAt: new Date("2020-01-01"),
				endsAt: new Date("2099-12-31"),
				isActive: true,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels.length).toBe(1);
		});

		it("skips deleted labels (orphaned assignments)", async () => {
			const label = await createTestLabel({
				slug: "orphan-active",
				isActive: true,
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			await mockData.delete("label", label.id);
			const labels = await controller.getActiveLabelsForProduct("prod_1");
			expect(labels.length).toBe(0);
		});

		it("correctly filters a mix of active, inactive, future, expired, and valid labels", async () => {
			const active = await createTestLabel({
				slug: "mix-active",
				isActive: true,
				priority: 5,
			});
			const inactive = await createTestLabel({
				slug: "mix-inactive",
				isActive: false,
			});
			const future = await createTestLabel({
				slug: "mix-future",
				isActive: true,
				startsAt: new Date("2099-01-01"),
			});
			const expired = await createTestLabel({
				slug: "mix-expired",
				isActive: true,
				endsAt: new Date("2020-01-01"),
			});
			const alsoActive = await createTestLabel({
				slug: "mix-also-active",
				isActive: true,
				priority: 10,
			});

			for (const label of [active, inactive, future, expired, alsoActive]) {
				await controller.assignLabel({
					productId: "prod_mix",
					labelId: label.id,
				});
			}

			const labels = await controller.getActiveLabelsForProduct("prod_mix");
			expect(labels.length).toBe(2);
			expect(labels[0].slug).toBe("mix-also-active");
			expect(labels[1].slug).toBe("mix-active");
		});
	});

	// ── getLabelStats edge cases ────────────────────────────────────────

	describe("getLabelStats – edge cases", () => {
		it("returns empty array when no labels exist", async () => {
			const stats = await controller.getLabelStats();
			expect(stats).toEqual([]);
		});

		it("defaults take to 50 when not specified", async () => {
			for (let i = 0; i < 55; i++) {
				await createTestLabel({
					slug: `stat-label-${i}`,
					name: `Stat Label ${i}`,
				});
			}
			const stats = await controller.getLabelStats();
			expect(stats.length).toBe(50);
		});

		it("take of 0 returns empty array", async () => {
			await createTestLabel({ slug: "stat-zero" });
			const stats = await controller.getLabelStats({ take: 0 });
			expect(stats).toEqual([]);
		});

		it("sorts labels with zero products alphabetically after those with products", async () => {
			const withProducts = await createTestLabel({
				slug: "has-products",
				name: "Has Products",
			});
			await createTestLabel({
				slug: "no-products",
				name: "No Products",
			});
			await controller.assignLabel({
				productId: "prod_1",
				labelId: withProducts.id,
			});
			const stats = await controller.getLabelStats();
			expect(stats[0].name).toBe("Has Products");
			expect(stats[0].productCount).toBe(1);
			expect(stats[1].name).toBe("No Products");
			expect(stats[1].productCount).toBe(0);
		});

		it("returns correct labelId in stats", async () => {
			const label = await createTestLabel({ slug: "stat-id-check" });
			const stats = await controller.getLabelStats();
			expect(stats[0].labelId).toBe(label.id);
		});

		it("reflects inactive labels in stats", async () => {
			await createTestLabel({
				slug: "stat-inactive",
				isActive: false,
			});
			const stats = await controller.getLabelStats();
			expect(stats[0].isActive).toBe(false);
		});
	});

	// ── Cross-cutting / integration edge cases ─────────────────────────

	describe("cross-cutting edge cases", () => {
		it("assign then delete then re-create label does not resurface old assignments", async () => {
			const label = await createTestLabel({ slug: "lifecycle" });
			await controller.assignLabel({
				productId: "prod_1",
				labelId: label.id,
			});
			await controller.deleteLabel(label.id);

			const newLabel = await createTestLabel({
				slug: "lifecycle-new",
				name: "New Lifecycle",
			});
			const result = await controller.getProductLabels("prod_1");
			// The old assignment referenced old label.id, which is gone
			expect(result.labels.length).toBe(0);
			// The new label has no assignments
			expect(await controller.countProductsForLabel(newLabel.id)).toBe(0);
		});

		it("getLabelBySlug returns first match when multiple have the same slug", async () => {
			// While slugs should be unique in practice, test the behavior
			await createTestLabel({ slug: "dupe", name: "First" });
			await createTestLabel({ slug: "dupe", name: "Second" });
			const found = await controller.getLabelBySlug("dupe");
			expect(found).not.toBeNull();
			// Should return first one found
			expect(found?.name).toBe("First");
		});
	});
});
