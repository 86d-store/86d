import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createProductLabelController } from "../service-impl";

/**
 * Store endpoint integration tests for the product-labels module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-product-labels: returns active labels for a product
 * 2. list-labels: returns active labels
 * 3. get-label: returns a single label by slug; 404 for inactive or missing
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGetProductLabels(data: DataService, productId: string) {
	const controller = createProductLabelController(data);
	const labels = await controller.getActiveLabelsForProduct(productId);
	return { labels };
}

type LabelType = "badge" | "tag" | "ribbon" | "banner" | "sticker" | "custom";

async function simulateListLabels(
	data: DataService,
	query: { type?: LabelType } = {},
) {
	const controller = createProductLabelController(data);
	const labels = await controller.listLabels({
		isActive: true,
		...(query.type != null && { type: query.type }),
	});
	return { labels };
}

async function simulateGetLabel(data: DataService, slug: string) {
	const controller = createProductLabelController(data);
	const label = await controller.getLabelBySlug(slug);
	if (!label?.isActive) {
		return { error: "Label not found", status: 404 };
	}
	return { label };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get product labels — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns active labels for a product", async () => {
		const ctrl = createProductLabelController(data);
		const label = await ctrl.createLabel({
			name: "New Arrival",
			slug: "new-arrival",
			displayText: "NEW",
			type: "badge",
			isActive: true,
			priority: 10,
		});
		await ctrl.assignLabel({
			labelId: label.id,
			productId: "prod_1",
		});

		const result = await simulateGetProductLabels(data, "prod_1");

		expect(result.labels).toHaveLength(1);
		expect(result.labels[0].displayText).toBe("NEW");
	});

	it("does not return inactive labels", async () => {
		const ctrl = createProductLabelController(data);
		const label = await ctrl.createLabel({
			name: "Discontinued",
			slug: "discontinued",
			displayText: "OLD",
			type: "badge",
			isActive: false,
			priority: 1,
		});
		await ctrl.assignLabel({
			labelId: label.id,
			productId: "prod_1",
		});

		const result = await simulateGetProductLabels(data, "prod_1");

		expect(result.labels).toHaveLength(0);
	});

	it("returns empty for product with no labels", async () => {
		const result = await simulateGetProductLabels(data, "prod_none");

		expect(result.labels).toHaveLength(0);
	});

	it("returns multiple labels sorted by priority", async () => {
		const ctrl = createProductLabelController(data);
		const low = await ctrl.createLabel({
			name: "On Sale",
			slug: "on-sale",
			displayText: "SALE",
			type: "badge",
			isActive: true,
			priority: 1,
		});
		const high = await ctrl.createLabel({
			name: "Best Seller",
			slug: "best-seller",
			displayText: "BEST",
			type: "badge",
			isActive: true,
			priority: 10,
		});
		await ctrl.assignLabel({ labelId: low.id, productId: "prod_1" });
		await ctrl.assignLabel({ labelId: high.id, productId: "prod_1" });

		const result = await simulateGetProductLabels(data, "prod_1");

		expect(result.labels).toHaveLength(2);
		expect(result.labels[0].displayText).toBe("BEST");
	});
});

describe("store endpoint: list labels — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active labels", async () => {
		const ctrl = createProductLabelController(data);
		await ctrl.createLabel({
			name: "Active Label",
			slug: "active-label",
			displayText: "ACTIVE",
			type: "badge",
			isActive: true,
			priority: 1,
		});
		await ctrl.createLabel({
			name: "Inactive Label",
			slug: "inactive-label",
			displayText: "OFF",
			type: "badge",
			isActive: false,
			priority: 1,
		});

		const result = await simulateListLabels(data);

		expect(result.labels).toHaveLength(1);
		expect(result.labels[0].displayText).toBe("ACTIVE");
	});

	it("returns empty when no active labels exist", async () => {
		const result = await simulateListLabels(data);

		expect(result.labels).toHaveLength(0);
	});
});

describe("store endpoint: get label by slug — single label lookup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active label by slug", async () => {
		const ctrl = createProductLabelController(data);
		await ctrl.createLabel({
			name: "Flash Sale",
			slug: "flash-sale",
			displayText: "FLASH",
			type: "ribbon",
			isActive: true,
			priority: 5,
		});

		const result = await simulateGetLabel(data, "flash-sale");

		expect("label" in result).toBe(true);
		if ("label" in result) {
			expect(result.label.slug).toBe("flash-sale");
			expect(result.label.displayText).toBe("FLASH");
		}
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetLabel(data, "ghost-label");

		expect(result).toEqual({ error: "Label not found", status: 404 });
	});

	it("returns 404 for inactive label", async () => {
		const ctrl = createProductLabelController(data);
		await ctrl.createLabel({
			name: "Old Promo",
			slug: "old-promo",
			displayText: "OLD",
			type: "badge",
			isActive: false,
			priority: 1,
		});

		const result = await simulateGetLabel(data, "old-promo");

		expect(result).toEqual({ error: "Label not found", status: 404 });
	});
});
