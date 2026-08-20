import { describe, expect, it, vi } from "vitest";
import { addProduct } from "../admin/endpoints/add-product";
import { bulkAddProducts } from "../admin/endpoints/bulk-add-products";
import { createFlashSale } from "../admin/endpoints/create-flash-sale";
import { deleteFlashSale } from "../admin/endpoints/delete-flash-sale";
import { getFlashSale } from "../admin/endpoints/get-flash-sale";
import { getStats } from "../admin/endpoints/get-stats";
import { listFlashSales } from "../admin/endpoints/list-flash-sales";
import { listProducts } from "../admin/endpoints/list-products";
import { removeProduct } from "../admin/endpoints/remove-product";
import { updateFlashSale } from "../admin/endpoints/update-flash-sale";
import type {
	FlashSale,
	FlashSaleController,
	FlashSaleProduct,
	FlashSaleStats,
	FlashSaleStatus,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeFlashSale(overrides: Partial<FlashSale> = {}): FlashSale {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Summer Flash",
		slug: "summer-flash",
		status: "draft" as FlashSaleStatus,
		startsAt: new Date(now.getTime() + 60 * 60 * 1000),
		endsAt: new Date(now.getTime() + 25 * 60 * 60 * 1000),
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeProduct(
	flashSaleId: string,
	overrides: Partial<FlashSaleProduct> = {},
): FlashSaleProduct {
	return {
		id: crypto.randomUUID(),
		flashSaleId,
		productId: "prod_1",
		salePrice: 800,
		originalPrice: 1000,
		stockSold: 0,
		sortOrder: 0,
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<FlashSaleController> = {},
): FlashSaleController {
	return {
		createFlashSale: vi.fn().mockResolvedValue(makeFlashSale()),
		getFlashSale: vi.fn().mockResolvedValue(null),
		getFlashSaleBySlug: vi.fn().mockResolvedValue(null),
		updateFlashSale: vi.fn().mockResolvedValue(null),
		deleteFlashSale: vi.fn().mockResolvedValue(false),
		listFlashSales: vi.fn().mockResolvedValue([]),
		countFlashSales: vi.fn().mockResolvedValue(0),
		addProduct: vi.fn().mockResolvedValue(makeProduct("sale_1")),
		updateProduct: vi.fn().mockResolvedValue(null),
		removeProduct: vi.fn().mockResolvedValue(false),
		listProducts: vi.fn().mockResolvedValue([]),
		countProducts: vi.fn().mockResolvedValue(0),
		bulkAddProducts: vi.fn().mockResolvedValue([]),
		recordSale: vi.fn().mockResolvedValue(null),
		getActiveSales: vi.fn().mockResolvedValue([]),
		getActiveProductDeal: vi.fn().mockResolvedValue(null),
		getActiveProductDeals: vi.fn().mockResolvedValue({}),
		getStats: vi.fn().mockResolvedValue({
			totalSales: 0,
			draftSales: 0,
			scheduledSales: 0,
			activeSales: 0,
			endedSales: 0,
			totalProducts: 0,
			totalUnitsSold: 0,
		} satisfies FlashSaleStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: FlashSaleController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { flashSales: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const addProductHandler = extractHandler(addProduct);
const bulkAddHandler = extractHandler(bulkAddProducts);
const createHandler = extractHandler(createFlashSale);
const deleteHandler = extractHandler(deleteFlashSale);
const getHandler = extractHandler(getFlashSale);
const statsHandler = extractHandler(getStats);
const listHandler = extractHandler(listFlashSales);
const listProductsHandler = extractHandler(listProducts);
const removeProductHandler = extractHandler(removeProduct);
const updateHandler = extractHandler(updateFlashSale);

// ── createFlashSale ───────────────────────────────────────────────────────────

describe("admin POST /flash-sales/create", () => {
	it("creates a flash sale and returns it", async () => {
		const now = new Date();
		const sale = makeFlashSale({ name: "Weekend Deal", slug: "weekend-deal" });
		const ctrl = makeController({
			createFlashSale: vi.fn().mockResolvedValue(sale),
		});
		const result = (await call(createHandler, {
			body: {
				name: "Weekend Deal",
				slug: "weekend-deal",
				startsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
				endsAt: new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString(),
			},
			controller: ctrl,
		})) as { sale: FlashSale };
		expect(result.sale.name).toBe("Weekend Deal");
		expect(result.sale.slug).toBe("weekend-deal");
		expect(ctrl.createFlashSale).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Weekend Deal", slug: "weekend-deal" }),
		);
	});

	it("returns 400 when end date is not after start date", async () => {
		const now = new Date();
		const result = (await call(createHandler, {
			body: {
				name: "Bad Sale",
				slug: "bad-sale",
				startsAt: now.toISOString(),
				endsAt: now.toISOString(),
			},
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/end date must be after start date/i);
	});

	it("returns 400 when slug already exists", async () => {
		const now = new Date();
		const existing = makeFlashSale({ slug: "taken-slug" });
		const ctrl = makeController({
			getFlashSaleBySlug: vi.fn().mockResolvedValue(existing),
		});
		const result = (await call(createHandler, {
			body: {
				name: "Another Sale",
				slug: "taken-slug",
				startsAt: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
				endsAt: new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString(),
			},
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(/slug already exists/i);
	});
});

// ── getFlashSale ──────────────────────────────────────────────────────────────

describe("admin GET /flash-sales/:id", () => {
	it("returns 404 when flash sale not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "nonexistent" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
		expect(result.error).toBe("Flash sale not found");
	});

	it("returns sale with products and product count", async () => {
		const sale = makeFlashSale({ id: "sale_1" });
		const products = [
			makeProduct("sale_1", { productId: "prod_1" }),
			makeProduct("sale_1", { productId: "prod_2" }),
		];
		const ctrl = makeController({
			getFlashSale: vi.fn().mockResolvedValue(sale),
			listProducts: vi.fn().mockResolvedValue(products),
			countProducts: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(getHandler, {
			params: { id: "sale_1" },
			controller: ctrl,
		})) as {
			sale: FlashSale;
			products: FlashSaleProduct[];
			productCount: number;
		};
		expect(result.sale.id).toBe("sale_1");
		expect(result.products).toHaveLength(2);
		expect(result.productCount).toBe(2);
	});

	it("calls listProducts and countProducts with the sale id", async () => {
		const sale = makeFlashSale({ id: "sale_2" });
		const ctrl = makeController({
			getFlashSale: vi.fn().mockResolvedValue(sale),
			listProducts: vi.fn().mockResolvedValue([]),
			countProducts: vi.fn().mockResolvedValue(0),
		});
		await call(getHandler, { params: { id: "sale_2" }, controller: ctrl });
		expect(ctrl.listProducts).toHaveBeenCalledWith("sale_2", expect.anything());
		expect(ctrl.countProducts).toHaveBeenCalledWith("sale_2");
	});
});

// ── updateFlashSale ───────────────────────────────────────────────────────────

describe("admin POST /flash-sales/:id/update", () => {
	it("returns 404 when flash sale not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { name: "New Name" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns updated sale on success", async () => {
		const updated = makeFlashSale({ id: "sale_1", name: "Updated Sale" });
		const ctrl = makeController({
			updateFlashSale: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateHandler, {
			params: { id: "sale_1" },
			body: { name: "Updated Sale" },
			controller: ctrl,
		})) as { sale: FlashSale };
		expect(result.sale.name).toBe("Updated Sale");
		expect(ctrl.updateFlashSale).toHaveBeenCalledWith(
			"sale_1",
			expect.objectContaining({ name: "Updated Sale" }),
		);
	});

	it("forwards status update to controller", async () => {
		const updated = makeFlashSale({ status: "active" });
		const ctrl = makeController({
			updateFlashSale: vi.fn().mockResolvedValue(updated),
		});
		const result = (await call(updateHandler, {
			params: { id: updated.id },
			body: { status: "active" },
			controller: ctrl,
		})) as { sale: FlashSale };
		expect(result.sale.status).toBe("active");
	});
});

// ── deleteFlashSale ───────────────────────────────────────────────────────────

describe("admin POST /flash-sales/:id/delete", () => {
	it("returns 404 when flash sale not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "gone" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes flash sale and returns deleted=true", async () => {
		const ctrl = makeController({
			deleteFlashSale: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "sale_1" },
			controller: ctrl,
		})) as { deleted: true };
		expect(result.deleted).toBe(true);
		expect(ctrl.deleteFlashSale).toHaveBeenCalledWith("sale_1");
	});
});

// ── listFlashSales ────────────────────────────────────────────────────────────

describe("admin GET /flash-sales", () => {
	it("returns empty list and zero total when no sales exist", async () => {
		const result = (await call(listHandler)) as {
			sales: FlashSale[];
			total: number;
		};
		expect(result.sales).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns sales and total", async () => {
		const sales = [
			makeFlashSale({ name: "Sale A" }),
			makeFlashSale({ name: "Sale B" }),
		];
		const ctrl = makeController({
			listFlashSales: vi.fn().mockResolvedValue(sales),
			countFlashSales: vi.fn().mockResolvedValue(2),
		});
		const result = (await call(listHandler, { controller: ctrl })) as {
			sales: FlashSale[];
			total: number;
		};
		expect(result.sales).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listHandler, { query: { status: "active" }, controller: ctrl });
		expect(ctrl.listFlashSales).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
		expect(ctrl.countFlashSales).toHaveBeenCalledWith(
			expect.objectContaining({ status: "active" }),
		);
	});

	it("uses default take=50 when not specified", async () => {
		const ctrl = makeController();
		await call(listHandler, { controller: ctrl });
		expect(ctrl.listFlashSales).toHaveBeenCalledWith(
			expect.objectContaining({ take: 50 }),
		);
	});
});

// ── getStats ──────────────────────────────────────────────────────────────────

describe("admin GET /flash-sales/stats", () => {
	it("returns zero-state stats when no sales exist", async () => {
		const result = (await call(statsHandler)) as { stats: FlashSaleStats };
		expect(result.stats.totalSales).toBe(0);
		expect(result.stats.totalUnitsSold).toBe(0);
	});

	it("returns live stats from controller", async () => {
		const stats: FlashSaleStats = {
			totalSales: 15,
			draftSales: 3,
			scheduledSales: 4,
			activeSales: 2,
			endedSales: 6,
			totalProducts: 120,
			totalUnitsSold: 850,
		};
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue(stats),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: FlashSaleStats;
		};
		expect(result.stats.totalSales).toBe(15);
		expect(result.stats.activeSales).toBe(2);
		expect(result.stats.totalUnitsSold).toBe(850);
	});
});

// ── addProduct ────────────────────────────────────────────────────────────────

describe("admin POST /flash-sales/:id/products/add", () => {
	it("returns 404 when flash sale not found", async () => {
		const result = (await call(addProductHandler, {
			params: { id: "missing" },
			body: { productId: "prod_1", salePrice: 800, originalPrice: 1000 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns 400 when sale price is not less than original price", async () => {
		const sale = makeFlashSale({ id: "sale_1" });
		const ctrl = makeController({
			getFlashSale: vi.fn().mockResolvedValue(sale),
		});
		const result = (await call(addProductHandler, {
			params: { id: "sale_1" },
			body: { productId: "prod_1", salePrice: 1000, originalPrice: 1000 },
			controller: ctrl,
		})) as { error: string; status: number };
		expect(result.status).toBe(400);
		expect(result.error).toMatch(
			/sale price must be less than original price/i,
		);
	});

	it("adds product and returns it", async () => {
		const sale = makeFlashSale({ id: "sale_1" });
		const product = makeProduct("sale_1", {
			productId: "prod_1",
			salePrice: 800,
			originalPrice: 1000,
		});
		const ctrl = makeController({
			getFlashSale: vi.fn().mockResolvedValue(sale),
			addProduct: vi.fn().mockResolvedValue(product),
		});
		const result = (await call(addProductHandler, {
			params: { id: "sale_1" },
			body: { productId: "prod_1", salePrice: 800, originalPrice: 1000 },
			controller: ctrl,
		})) as { product: FlashSaleProduct };
		expect(result.product.productId).toBe("prod_1");
		expect(result.product.salePrice).toBe(800);
		expect(ctrl.addProduct).toHaveBeenCalledWith(
			expect.objectContaining({
				flashSaleId: "sale_1",
				productId: "prod_1",
				salePrice: 800,
				originalPrice: 1000,
			}),
		);
	});

	it("passes optional stockLimit to controller", async () => {
		const sale = makeFlashSale({ id: "sale_1" });
		const product = makeProduct("sale_1", { stockLimit: 50 });
		const ctrl = makeController({
			getFlashSale: vi.fn().mockResolvedValue(sale),
			addProduct: vi.fn().mockResolvedValue(product),
		});
		await call(addProductHandler, {
			params: { id: "sale_1" },
			body: {
				productId: "prod_1",
				salePrice: 500,
				originalPrice: 800,
				stockLimit: 50,
			},
			controller: ctrl,
		});
		expect(ctrl.addProduct).toHaveBeenCalledWith(
			expect.objectContaining({ stockLimit: 50 }),
		);
	});
});

// ── listProducts ──────────────────────────────────────────────────────────────

describe("admin GET /flash-sales/:id/products", () => {
	it("returns empty list and zero total when no products exist", async () => {
		const result = (await call(listProductsHandler, {
			params: { id: "sale_1" },
		})) as { products: FlashSaleProduct[]; total: number };
		expect(result.products).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns products and total for the sale", async () => {
		const products = [
			makeProduct("sale_1", { productId: "prod_1" }),
			makeProduct("sale_1", { productId: "prod_2" }),
			makeProduct("sale_1", { productId: "prod_3" }),
		];
		const ctrl = makeController({
			listProducts: vi.fn().mockResolvedValue(products),
			countProducts: vi.fn().mockResolvedValue(3),
		});
		const result = (await call(listProductsHandler, {
			params: { id: "sale_1" },
			controller: ctrl,
		})) as { products: FlashSaleProduct[]; total: number };
		expect(result.products).toHaveLength(3);
		expect(result.total).toBe(3);
	});

	it("forwards take and skip to controller", async () => {
		const ctrl = makeController();
		await call(listProductsHandler, {
			params: { id: "sale_1" },
			query: { take: "10", skip: "5" },
			controller: ctrl,
		});
		expect(ctrl.listProducts).toHaveBeenCalledWith(
			"sale_1",
			expect.objectContaining({ take: 10, skip: 5 }),
		);
	});
});

// ── removeProduct ─────────────────────────────────────────────────────────────

describe("admin POST /flash-sales/:id/products/:productId/remove", () => {
	it("returns 404 when product not found in the flash sale", async () => {
		const result = (await call(removeProductHandler, {
			params: { id: "sale_1", productId: "prod_1" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("removes product and returns removed=true", async () => {
		const ctrl = makeController({
			removeProduct: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(removeProductHandler, {
			params: { id: "sale_1", productId: "prod_1" },
			controller: ctrl,
		})) as { removed: true };
		expect(result.removed).toBe(true);
		expect(ctrl.removeProduct).toHaveBeenCalledWith("sale_1", "prod_1");
	});
});

// ── bulkAddProducts ───────────────────────────────────────────────────────────

describe("admin POST /flash-sales/:id/products/bulk", () => {
	it("returns 404 when flash sale not found", async () => {
		const result = (await call(bulkAddHandler, {
			params: { id: "missing" },
			body: {
				products: [
					{ productId: "prod_1", salePrice: 800, originalPrice: 1000 },
				],
			},
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("bulk adds products and returns them", async () => {
		const sale = makeFlashSale({ id: "sale_1" });
		const products = [
			makeProduct("sale_1", { productId: "prod_1" }),
			makeProduct("sale_1", { productId: "prod_2" }),
		];
		const ctrl = makeController({
			getFlashSale: vi.fn().mockResolvedValue(sale),
			bulkAddProducts: vi.fn().mockResolvedValue(products),
		});
		const result = (await call(bulkAddHandler, {
			params: { id: "sale_1" },
			body: {
				products: [
					{ productId: "prod_1", salePrice: 800, originalPrice: 1000 },
					{ productId: "prod_2", salePrice: 600, originalPrice: 900 },
				],
			},
			controller: ctrl,
		})) as { products: FlashSaleProduct[] };
		expect(result.products).toHaveLength(2);
		expect(ctrl.bulkAddProducts).toHaveBeenCalledWith(
			"sale_1",
			expect.arrayContaining([
				expect.objectContaining({ productId: "prod_1", salePrice: 800 }),
				expect.objectContaining({ productId: "prod_2", salePrice: 600 }),
			]),
		);
	});
});
