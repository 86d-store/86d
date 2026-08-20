import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBundleController } from "../service-impl";

/**
 * Store endpoint integration tests for the bundles module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-active: returns only active bundles with their items
 * 2. get-by-slug: returns a single active bundle by slug
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListActive(
	data: DataService,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createBundleController(data);
	const bundles = await controller.listActive(query);
	return { bundles };
}

async function simulateGetBySlug(data: DataService, slug: string) {
	const controller = createBundleController(data);
	const bundle = await controller.getActiveBySlug(slug);
	if (!bundle) {
		return { error: "Bundle not found", status: 404 };
	}
	return { bundle };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list active bundles", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active bundles", async () => {
		const ctrl = createBundleController(data);
		const active = await ctrl.create({
			name: "Summer Pack",
			slug: "summer-pack",
			discountType: "percentage",
			discountValue: 10,
		});
		await ctrl.update(active.id, { status: "active" });
		await ctrl.addItem({
			bundleId: active.id,
			productId: "prod_1",

			quantity: 1,
		});
		await ctrl.create({
			name: "Draft Pack",
			slug: "draft-pack",
			discountType: "fixed",
			discountValue: 500,
		});

		const result = await simulateListActive(data);

		expect(result.bundles).toHaveLength(1);
		expect(result.bundles[0].name).toBe("Summer Pack");
	});

	it("returns bundles with their items", async () => {
		const ctrl = createBundleController(data);
		const bundle = await ctrl.create({
			name: "Combo",
			slug: "combo",
			discountType: "percentage",
			discountValue: 15,
		});
		await ctrl.update(bundle.id, { status: "active" });
		await ctrl.addItem({
			bundleId: bundle.id,
			productId: "prod_a",

			quantity: 2,
		});
		await ctrl.addItem({
			bundleId: bundle.id,
			productId: "prod_b",

			quantity: 1,
		});

		const result = await simulateListActive(data);

		expect(result.bundles).toHaveLength(1);
		expect(result.bundles[0].items).toHaveLength(2);
	});

	it("returns empty when no active bundles exist", async () => {
		const result = await simulateListActive(data);

		expect(result.bundles).toHaveLength(0);
	});

	it("supports pagination", async () => {
		const ctrl = createBundleController(data);
		for (let i = 0; i < 5; i++) {
			const b = await ctrl.create({
				name: `Bundle ${i}`,
				slug: `bundle-${i}`,
				discountType: "percentage",
				discountValue: 10,
			});
			await ctrl.update(b.id, { status: "active" });
			await ctrl.addItem({
				bundleId: b.id,
				productId: `prod_${i}`,

				quantity: 1,
			});
		}

		const result = await simulateListActive(data, { take: 2 });

		expect(result.bundles).toHaveLength(2);
	});
});

describe("store endpoint: get active bundle by slug", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active bundle with items", async () => {
		const ctrl = createBundleController(data);
		const bundle = await ctrl.create({
			name: "Holiday Bundle",
			slug: "holiday-bundle",
			discountType: "fixed",
			discountValue: 1000,
		});
		await ctrl.update(bundle.id, { status: "active" });
		await ctrl.addItem({
			bundleId: bundle.id,
			productId: "prod_gift",

			quantity: 1,
		});

		const result = await simulateGetBySlug(data, "holiday-bundle");

		expect("bundle" in result).toBe(true);
		if ("bundle" in result) {
			expect(result.bundle.name).toBe("Holiday Bundle");
			expect(result.bundle.items).toHaveLength(1);
		}
	});

	it("returns 404 for draft bundle", async () => {
		const ctrl = createBundleController(data);
		await ctrl.create({
			name: "Draft",
			slug: "draft-bundle",
			discountType: "percentage",
			discountValue: 5,
		});

		const result = await simulateGetBySlug(data, "draft-bundle");

		expect(result).toEqual({ error: "Bundle not found", status: 404 });
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetBySlug(data, "no-such-bundle");

		expect(result).toEqual({ error: "Bundle not found", status: 404 });
	});
});
