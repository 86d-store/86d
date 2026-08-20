import { describe, expect, it, vi } from "vitest";
import { assignProducts } from "../admin/endpoints/assign-products";
import { createBrand } from "../admin/endpoints/create-brand";
import { deleteBrand } from "../admin/endpoints/delete-brand";
import { getBrand } from "../admin/endpoints/get-brand";
import { getBrandProducts } from "../admin/endpoints/get-brand-products";
import { getStats } from "../admin/endpoints/get-stats";
import { listBrands } from "../admin/endpoints/list-brands";
import { unassignProducts } from "../admin/endpoints/unassign-products";
import { updateBrand } from "../admin/endpoints/update-brand";
import type {
	Brand,
	BrandController,
	BrandProduct,
	BrandStats,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeBrand(overrides: Partial<Brand> = {}): Brand {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Acme",
		slug: "acme",
		isActive: true,
		isFeatured: false,
		position: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeBrandProduct(overrides: Partial<BrandProduct> = {}): BrandProduct {
	return {
		id: crypto.randomUUID(),
		brandId: "brand_1",
		productId: "prod_1",
		assignedAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<BrandController> = {},
): BrandController {
	return {
		createBrand: vi.fn().mockResolvedValue(makeBrand()),
		getBrand: vi.fn().mockResolvedValue(null),
		getBrandBySlug: vi.fn().mockResolvedValue(null),
		updateBrand: vi.fn().mockResolvedValue(null),
		deleteBrand: vi.fn().mockResolvedValue(false),
		listBrands: vi.fn().mockResolvedValue([]),
		countBrands: vi.fn().mockResolvedValue(0),
		assignProduct: vi.fn().mockResolvedValue(makeBrandProduct()),
		unassignProduct: vi.fn().mockResolvedValue(false),
		getBrandProducts: vi.fn().mockResolvedValue([]),
		countBrandProducts: vi.fn().mockResolvedValue(0),
		getBrandForProduct: vi.fn().mockResolvedValue(null),
		bulkAssignProducts: vi.fn().mockResolvedValue(0),
		bulkUnassignProducts: vi.fn().mockResolvedValue(0),
		getFeaturedBrands: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue({
			totalBrands: 0,
			activeBrands: 0,
			featuredBrands: 0,
			totalProducts: 0,
		} satisfies BrandStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: BrandController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { brands: opts.controller ?? makeController() } },
	});
}

const listHandler = extractHandler(listBrands);
const statsHandler = extractHandler(getStats);
const createHandler = extractHandler(createBrand);
const getHandler = extractHandler(getBrand);
const updateHandler = extractHandler(updateBrand);
const deleteHandler = extractHandler(deleteBrand);
const productsHandler = extractHandler(getBrandProducts);
const assignHandler = extractHandler(assignProducts);
const unassignHandler = extractHandler(unassignProducts);

describe("admin GET /brands", () => {
	it("returns empty list", async () => {
		const result = (await call(listHandler)) as {
			brands: Brand[];
			total: number;
		};
		expect(result.brands).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("forwards active filter", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { active: "true" }, controller: ctrl });
		expect(ctrl.listBrands).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});

	it("returns brands when present", async () => {
		const brand = makeBrand({ name: "Nike" });
		const ctrl = makeController({
			listBrands: vi.fn().mockResolvedValue([brand]),
			countBrands: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			brands: Brand[];
			total: number;
		};
		expect(result.brands).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("admin GET /brands/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as { stats: BrandStats };
		expect(result.stats.totalBrands).toBe(0);
	});

	it("returns real stats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalBrands: 12,
				activeBrands: 10,
				featuredBrands: 3,
				totalProducts: 200,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: BrandStats;
		};
		expect(result.stats.totalBrands).toBe(12);
		expect(result.stats.totalProducts).toBe(200);
	});
});

describe("admin POST /brands/create", () => {
	it("returns 400 when slug already exists", async () => {
		const ctrl = makeController({
			getBrandBySlug: vi.fn().mockResolvedValue(makeBrand()),
		});
		const result = (await call(createHandler, {
			body: { name: "Acme", slug: "acme" },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/slug/i);
	});

	it("creates and returns the brand", async () => {
		const brand = makeBrand({ name: "Nike" });
		const ctrl = makeController({
			getBrandBySlug: vi.fn().mockResolvedValue(null),
			createBrand: vi.fn().mockResolvedValue(brand),
		});
		const result = (await call(createHandler, {
			body: { name: "Nike", slug: "nike" },
			controller: ctrl,
		})) as { brand: Brand };
		expect(result.brand.name).toBe("Nike");
	});
});

describe("admin GET /brands/:id", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns brand and productCount when found", async () => {
		const brand = makeBrand({ id: "brand_1" });
		const ctrl = makeController({
			getBrand: vi.fn().mockResolvedValue(brand),
			countBrandProducts: vi.fn().mockResolvedValue(7),
		});
		const result = (await call(getHandler, {
			params: { id: "brand_1" },
			controller: ctrl,
		})) as { brand: Brand; productCount: number };
		expect(result.brand.id).toBe("brand_1");
		expect(result.productCount).toBe(7);
	});
});

describe("admin POST /brands/:id/update", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { name: "X" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates and returns the brand", async () => {
		const brand = makeBrand({ name: "Updated" });
		const ctrl = makeController({
			updateBrand: vi.fn().mockResolvedValue(brand),
		});
		const result = (await call(updateHandler, {
			params: { id: brand.id },
			body: { name: "Updated" },
			controller: ctrl,
		})) as { brand: Brand };
		expect(result.brand.name).toBe("Updated");
	});
});

describe("admin POST /brands/:id/delete", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes and returns success", async () => {
		const ctrl = makeController({
			deleteBrand: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "brand_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin GET /brands/:id/products", () => {
	it("returns 404 when brand not found", async () => {
		const result = (await call(productsHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns products and total when brand exists", async () => {
		const brand = makeBrand({ id: "brand_1" });
		const products = [makeBrandProduct({ brandId: "brand_1" })];
		const ctrl = makeController({
			getBrand: vi.fn().mockResolvedValue(brand),
			getBrandProducts: vi.fn().mockResolvedValue(products),
			countBrandProducts: vi.fn().mockResolvedValue(1),
		});
		const result = (await call(productsHandler, {
			params: { id: "brand_1" },
			controller: ctrl,
		})) as { products: BrandProduct[]; total: number };
		expect(result.products).toHaveLength(1);
		expect(result.total).toBe(1);
	});
});

describe("admin POST /brands/:id/products/assign", () => {
	it("returns 404 when brand not found", async () => {
		const result = (await call(assignHandler, {
			params: { id: "missing" },
			body: { productIds: ["prod_1"] },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("assigns products and returns count", async () => {
		const brand = makeBrand({ id: "brand_1" });
		const ctrl = makeController({
			getBrand: vi.fn().mockResolvedValue(brand),
			bulkAssignProducts: vi.fn().mockResolvedValue(3),
		});
		const result = (await call(assignHandler, {
			params: { id: "brand_1" },
			body: { productIds: ["p1", "p2", "p3"] },
			controller: ctrl,
		})) as { assigned: number };
		expect(result.assigned).toBe(3);
	});
});

describe("admin POST /brands/:id/products/unassign", () => {
	it("returns 404 when brand not found", async () => {
		const result = (await call(unassignHandler, {
			params: { id: "missing" },
			body: { productIds: ["prod_1"] },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("unassigns products and returns count", async () => {
		const brand = makeBrand({ id: "brand_1" });
		const ctrl = makeController({
			getBrand: vi.fn().mockResolvedValue(brand),
			bulkUnassignProducts: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(unassignHandler, {
			params: { id: "brand_1" },
			body: { productIds: ["p1", "p2"] },
			controller: ctrl,
		})) as { removed: number };
		expect(result.removed).toBe(2);
	});
});
