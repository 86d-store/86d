import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createVendorController } from "../service-impl";

/**
 * Store endpoint integration tests for the vendors module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-vendors: returns only active/approved vendors
 * 2. get-vendor: returns a single vendor by slug
 * 3. vendor-products: lists products for a vendor
 * 4. apply: creates a new vendor application
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListVendors(
	data: DataService,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createVendorController(data);
	const vendors = await controller.listVendors({
		status: "active",
		...query,
	});
	return { vendors };
}

async function simulateGetVendor(data: DataService, slug: string) {
	const controller = createVendorController(data);
	const vendor = await controller.getVendorBySlug(slug);
	if (!vendor || vendor.status !== "active") {
		return { error: "Vendor not found", status: 404 };
	}
	return { vendor };
}

async function simulateVendorProducts(
	data: DataService,
	vendorId: string,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createVendorController(data);
	const vendor = await controller.getVendor(vendorId);
	if (!vendor || vendor.status !== "active") {
		return { error: "Vendor not found", status: 404 };
	}
	const products = await controller.listVendorProducts({
		vendorId,
		status: "active",
		...query,
	});
	return { products };
}

async function simulateApply(
	data: DataService,
	body: {
		name: string;
		slug: string;
		email: string;
		description?: string;
		phone?: string;
		website?: string;
	},
) {
	const controller = createVendorController(data);
	const vendor = await controller.createVendor({
		name: body.name,
		slug: body.slug,
		email: body.email,
		status: "pending",
		...(body.description != null && { description: body.description }),
		...(body.phone != null && { phone: body.phone }),
		...(body.website != null && { website: body.website }),
	});
	return { vendor };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list vendors — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active vendors", async () => {
		const ctrl = createVendorController(data);
		await ctrl.createVendor({
			name: "Good Vendor",
			slug: "good-vendor",
			email: "good@example.com",
			status: "active",
		});
		await ctrl.createVendor({
			name: "Pending Vendor",
			slug: "pending-vendor",
			email: "pending@example.com",
			status: "pending",
		});

		const result = await simulateListVendors(data);

		expect(result.vendors).toHaveLength(1);
		expect(result.vendors[0].name).toBe("Good Vendor");
	});

	it("returns empty when no active vendors exist", async () => {
		const result = await simulateListVendors(data);

		expect(result.vendors).toHaveLength(0);
	});

	it("supports pagination", async () => {
		const ctrl = createVendorController(data);
		for (let i = 0; i < 5; i++) {
			await ctrl.createVendor({
				name: `Vendor ${i}`,
				slug: `vendor-${i}`,
				email: `v${i}@example.com`,
				status: "active",
			});
		}

		const result = await simulateListVendors(data, { take: 2 });

		expect(result.vendors).toHaveLength(2);
	});
});

describe("store endpoint: get vendor by slug", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active vendor", async () => {
		const ctrl = createVendorController(data);
		await ctrl.createVendor({
			name: "Artisan Co",
			slug: "artisan-co",
			email: "hello@artisan.co",
			status: "active",
			description: "Handmade goods",
		});

		const result = await simulateGetVendor(data, "artisan-co");

		expect("vendor" in result).toBe(true);
		if ("vendor" in result) {
			expect(result.vendor.name).toBe("Artisan Co");
		}
	});

	it("returns 404 for pending vendor", async () => {
		const ctrl = createVendorController(data);
		await ctrl.createVendor({
			name: "New Vendor",
			slug: "new-vendor",
			email: "new@example.com",
			status: "pending",
		});

		const result = await simulateGetVendor(data, "new-vendor");

		expect(result).toEqual({ error: "Vendor not found", status: 404 });
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetVendor(data, "no-such-vendor");

		expect(result).toEqual({ error: "Vendor not found", status: 404 });
	});
});

describe("store endpoint: vendor products", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns products for an active vendor", async () => {
		const ctrl = createVendorController(data);
		const vendor = await ctrl.createVendor({
			name: "Shop",
			slug: "shop",
			email: "shop@example.com",
			status: "active",
		});
		await ctrl.assignProduct({
			vendorId: vendor.id,
			productId: "prod_1",
			commissionOverride: 10,
		});

		const result = await simulateVendorProducts(data, vendor.id);

		expect("products" in result).toBe(true);
		if ("products" in result) {
			expect(result.products).toHaveLength(1);
		}
	});

	it("returns 404 for inactive vendor's products", async () => {
		const ctrl = createVendorController(data);
		const vendor = await ctrl.createVendor({
			name: "Suspended",
			slug: "suspended",
			email: "sus@example.com",
			status: "suspended",
		});

		const result = await simulateVendorProducts(data, vendor.id);

		expect(result).toEqual({ error: "Vendor not found", status: 404 });
	});
});

describe("store endpoint: apply as vendor", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("creates a vendor application in pending status", async () => {
		const result = await simulateApply(data, {
			name: "My Shop",
			slug: "my-shop",
			email: "apply@example.com",
			description: "I sell great things",
		});

		expect("vendor" in result).toBe(true);
		if ("vendor" in result) {
			expect(result.vendor.status).toBe("pending");
			expect(result.vendor.name).toBe("My Shop");
		}
	});
});
