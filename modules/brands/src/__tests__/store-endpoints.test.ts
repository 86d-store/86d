import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { Brand } from "../service";
import { createBrandController } from "../service-impl";

/**
 * Store endpoint integration tests for the brands module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-brands: active-only filter, featured filter, pagination
 * 2. get-brand: slug lookup, inactive returns 404
 * 3. get-brand-products: validates brand active, returns products
 * 4. get-featured: featured + active brands with limit
 * 5. get-product-brand: reverse lookup from product to brand
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListBrands(
	data: DataService,
	query: { featured?: "true" | "false"; take?: number; skip?: number } = {},
) {
	const controller = createBrandController(data);
	const where: { isActive: boolean; isFeatured?: boolean } = {
		isActive: true,
	};
	if (query.featured === "true") where.isFeatured = true;
	if (query.featured === "false") where.isFeatured = false;

	const brands = await controller.listBrands({
		...where,
		take: query.take ?? 50,
		skip: query.skip ?? 0,
	});
	return { brands };
}

async function simulateGetBrand(data: DataService, slug: string) {
	const controller = createBrandController(data);
	const brand = await controller.getBrandBySlug(slug);
	if (!brand?.isActive) {
		return { error: "Brand not found", status: 404 };
	}
	return { brand };
}

async function simulateGetBrandProducts(
	data: DataService,
	slug: string,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createBrandController(data);
	const brand = await controller.getBrandBySlug(slug);
	if (!brand?.isActive) {
		return { error: "Brand not found", status: 404 };
	}

	const products = await controller.getBrandProducts({
		brandId: brand.id,
		take: query.take ?? 50,
		skip: query.skip ?? 0,
	});
	return { brand, products };
}

async function simulateGetFeatured(
	data: DataService,
	query: { limit?: number } = {},
) {
	const controller = createBrandController(data);
	const brands = await controller.getFeaturedBrands(query.limit ?? 10);
	return { brands };
}

async function simulateGetProductBrand(data: DataService, productId: string) {
	const controller = createBrandController(data);
	const brand = await controller.getBrandForProduct(productId);
	return { brand };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list brands — active only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active brands", async () => {
		const ctrl = createBrandController(data);
		await ctrl.createBrand({ name: "Active Brand", slug: "active" });
		await ctrl.createBrand({
			name: "Inactive Brand",
			slug: "inactive",
			isActive: false,
		});

		const result = await simulateListBrands(data);

		expect(result.brands).toHaveLength(1);
		expect((result.brands[0] as Brand).name).toBe("Active Brand");
	});

	it("filters by featured status", async () => {
		const ctrl = createBrandController(data);
		await ctrl.createBrand({
			name: "Featured",
			slug: "featured",
			isFeatured: true,
		});
		await ctrl.createBrand({ name: "Normal", slug: "normal" });

		const featured = await simulateListBrands(data, { featured: "true" });
		expect(featured.brands).toHaveLength(1);
		expect((featured.brands[0] as Brand).name).toBe("Featured");

		const nonFeatured = await simulateListBrands(data, {
			featured: "false",
		});
		expect(nonFeatured.brands).toHaveLength(1);
		expect((nonFeatured.brands[0] as Brand).name).toBe("Normal");
	});

	it("paginates with take/skip", async () => {
		const ctrl = createBrandController(data);
		for (let i = 0; i < 5; i++) {
			await ctrl.createBrand({ name: `Brand ${i}`, slug: `brand-${i}` });
		}

		const page1 = await simulateListBrands(data, { take: 2, skip: 0 });
		const page2 = await simulateListBrands(data, { take: 2, skip: 2 });
		const page3 = await simulateListBrands(data, { take: 2, skip: 4 });

		expect(page1.brands).toHaveLength(2);
		expect(page2.brands).toHaveLength(2);
		expect(page3.brands).toHaveLength(1);
	});

	it("returns empty when no active brands exist", async () => {
		const ctrl = createBrandController(data);
		await ctrl.createBrand({
			name: "Hidden",
			slug: "hidden",
			isActive: false,
		});

		const result = await simulateListBrands(data);

		expect(result.brands).toHaveLength(0);
	});
});

describe("store endpoint: get brand — slug lookup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an active brand by slug", async () => {
		const ctrl = createBrandController(data);
		await ctrl.createBrand({
			name: "Nike",
			slug: "nike",
			description: "Just Do It",
		});

		const result = await simulateGetBrand(data, "nike");

		expect("brand" in result).toBe(true);
		if ("brand" in result) {
			expect(result.brand.name).toBe("Nike");
		}
	});

	it("returns 404 for inactive brand", async () => {
		const ctrl = createBrandController(data);
		await ctrl.createBrand({
			name: "Retired",
			slug: "retired",
			isActive: false,
		});

		const result = await simulateGetBrand(data, "retired");

		expect(result).toEqual({ error: "Brand not found", status: 404 });
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetBrand(data, "nonexistent");

		expect(result).toEqual({ error: "Brand not found", status: 404 });
	});
});

describe("store endpoint: get brand products — active brand check", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns products for an active brand", async () => {
		const ctrl = createBrandController(data);
		const brand = await ctrl.createBrand({
			name: "Nike",
			slug: "nike",
		});
		await ctrl.assignProduct({ brandId: brand.id, productId: "prod_1" });
		await ctrl.assignProduct({ brandId: brand.id, productId: "prod_2" });

		const result = await simulateGetBrandProducts(data, "nike");

		expect("products" in result).toBe(true);
		if ("products" in result && "brand" in result) {
			expect(result.products).toHaveLength(2);
			expect(result.brand.name).toBe("Nike");
		}
	});

	it("returns 404 for inactive brand", async () => {
		const ctrl = createBrandController(data);
		const brand = await ctrl.createBrand({
			name: "Old",
			slug: "old",
			isActive: false,
		});
		await ctrl.assignProduct({ brandId: brand.id, productId: "prod_1" });

		const result = await simulateGetBrandProducts(data, "old");

		expect(result).toEqual({ error: "Brand not found", status: 404 });
	});

	it("returns empty products for brand with no assignments", async () => {
		const ctrl = createBrandController(data);
		await ctrl.createBrand({ name: "Empty", slug: "empty" });

		const result = await simulateGetBrandProducts(data, "empty");

		expect("products" in result).toBe(true);
		if ("products" in result) {
			expect(result.products).toHaveLength(0);
		}
	});

	it("paginates products", async () => {
		const ctrl = createBrandController(data);
		const brand = await ctrl.createBrand({
			name: "Big",
			slug: "big",
		});
		for (let i = 0; i < 5; i++) {
			await ctrl.assignProduct({ brandId: brand.id, productId: `prod_${i}` });
		}

		const page1 = await simulateGetBrandProducts(data, "big", {
			take: 2,
			skip: 0,
		});
		expect("products" in page1).toBe(true);
		if ("products" in page1) {
			expect(page1.products).toHaveLength(2);
		}
	});
});

describe("store endpoint: featured brands", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only active featured brands", async () => {
		const ctrl = createBrandController(data);
		await ctrl.createBrand({
			name: "Featured Active",
			slug: "fa",
			isFeatured: true,
		});
		await ctrl.createBrand({
			name: "Featured Inactive",
			slug: "fi",
			isFeatured: true,
			isActive: false,
		});
		await ctrl.createBrand({
			name: "Normal",
			slug: "normal",
		});

		const result = await simulateGetFeatured(data);

		expect(result.brands).toHaveLength(1);
		expect((result.brands[0] as Brand).name).toBe("Featured Active");
	});

	it("respects limit", async () => {
		const ctrl = createBrandController(data);
		for (let i = 0; i < 5; i++) {
			await ctrl.createBrand({
				name: `Featured ${i}`,
				slug: `featured-${i}`,
				isFeatured: true,
			});
		}

		const result = await simulateGetFeatured(data, { limit: 2 });

		expect(result.brands).toHaveLength(2);
	});

	it("returns empty when no featured brands exist", async () => {
		const ctrl = createBrandController(data);
		await ctrl.createBrand({ name: "Normal", slug: "normal" });

		const result = await simulateGetFeatured(data);

		expect(result.brands).toHaveLength(0);
	});
});

describe("store endpoint: get product brand — reverse lookup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns the brand for a product", async () => {
		const ctrl = createBrandController(data);
		const brand = await ctrl.createBrand({
			name: "Nike",
			slug: "nike",
		});
		await ctrl.assignProduct({ brandId: brand.id, productId: "prod_sneakers" });

		const result = await simulateGetProductBrand(data, "prod_sneakers");

		expect(result.brand).not.toBeNull();
		expect((result.brand as Brand).name).toBe("Nike");
	});

	it("returns null when product has no brand", async () => {
		const result = await simulateGetProductBrand(data, "prod_no_brand");

		expect(result.brand).toBeNull();
	});

	it("returns null for inactive brand (filters by active status)", async () => {
		const ctrl = createBrandController(data);
		const brand = await ctrl.createBrand({
			name: "Legacy",
			slug: "legacy",
			isActive: false,
		});
		await ctrl.assignProduct({ brandId: brand.id, productId: "prod_legacy" });

		const result = await simulateGetProductBrand(data, "prod_legacy");

		expect(result.brand).toBeNull();
	});
});
