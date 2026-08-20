import { beforeEach, describe, expect, it, vi } from "vitest";

const {
	mockModuleFindFirst,
	mockModuleDataFindFirst,
	mockModuleDataFindMany,
	mockModuleDataCount,
} = vi.hoisted(() => ({
	mockModuleFindFirst: vi.fn(),
	mockModuleDataFindFirst: vi.fn(),
	mockModuleDataFindMany: vi.fn(),
	mockModuleDataCount: vi.fn(),
}));

// Make React cache a passthrough so getModuleDbId is not memoized between tests
vi.mock("react", () => ({
	cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("db", () => ({
	db: {
		module: { findFirst: mockModuleFindFirst },
		moduleData: {
			findFirst: mockModuleDataFindFirst,
			findMany: mockModuleDataFindMany,
			count: mockModuleDataCount,
		},
	},
	Prisma: { JsonNull: null },
}));

vi.mock("env", () => ({
	default: { STORE_ID: "store-1" },
}));

import {
	prefetchCategories,
	prefetchProductBySlug,
	prefetchProducts,
} from "../server-prefetch";

const NOW = new Date("2025-01-15T10:00:00.000Z");
const LATER = new Date("2025-06-01T12:00:00.000Z");

function makeProductRow(overrides: Record<string, unknown> = {}) {
	return {
		id: "prod-1",
		data: {
			name: "Test Sneaker",
			slug: "test-sneaker",
			description: "A fine sneaker",
			shortDescription: "Fine sneaker",
			price: 8999,
			compareAtPrice: 9999,
			sku: "SKU-001",
			inventory: 42,
			trackInventory: true,
			allowBackorder: false,
			status: "active",
			categoryId: "cat-1",
			images: ["img1.jpg", "img2.jpg"],
			tags: ["running", "sport"],
			isFeatured: true,
			weight: 0.5,
			weightUnit: "kg",
			createdAt: NOW.toISOString(),
			updatedAt: LATER.toISOString(),
			...overrides,
		},
		createdAt: NOW,
		updatedAt: LATER,
	};
}

// ── prefetchProducts ────────────────────────────────────────────────

describe("prefetchProducts", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockModuleFindFirst.mockResolvedValue({ id: "module-1" });
	});

	it("returns null when STORE_ID is not set", async () => {
		mockModuleFindFirst.mockResolvedValue(null);
		const result = await prefetchProducts();
		expect(result).toBeNull();
	});

	it("returns null when the products module is not registered", async () => {
		mockModuleFindFirst.mockResolvedValue(null);
		const result = await prefetchProducts();
		expect(result).toBeNull();
	});

	it("maps DB rows to PrefetchedProduct objects", async () => {
		const row = makeProductRow();
		mockModuleDataFindMany.mockResolvedValue([row]);
		mockModuleDataCount.mockResolvedValue(1);

		const result = await prefetchProducts();

		expect(result).not.toBeNull();
		expect(result?.total).toBe(1);
		const product = result?.products[0];
		expect(product?.id).toBe("prod-1");
		expect(product?.name).toBe("Test Sneaker");
		expect(product?.slug).toBe("test-sneaker");
		expect(product?.price).toBe(8999);
		expect(product?.compareAtPrice).toBe(9999);
		expect(product?.inventory).toBe(42);
		expect(product?.trackInventory).toBe(true);
		expect(product?.allowBackorder).toBe(false);
		expect(product?.status).toBe("active");
		expect(product?.images).toEqual(["img1.jpg", "img2.jpg"]);
		expect(product?.tags).toEqual(["running", "sport"]);
		expect(product?.isFeatured).toBe(true);
		expect(product?.weight).toBe(0.5);
		expect(product?.weightUnit).toBe("kg");
		expect(product?.categoryId).toBe("cat-1");
		expect(product?.createdAt).toBe(NOW.toISOString());
		expect(product?.updatedAt).toBe(LATER.toISOString());
	});

	it("applies default values for missing optional fields", async () => {
		const row = makeProductRow({
			description: undefined,
			shortDescription: undefined,
			compareAtPrice: undefined,
			sku: undefined,
			categoryId: undefined,
			images: undefined,
			tags: undefined,
			weight: undefined,
			weightUnit: undefined,
			trackInventory: undefined,
			allowBackorder: undefined,
			status: undefined,
			isFeatured: undefined,
		});
		mockModuleDataFindMany.mockResolvedValue([row]);
		mockModuleDataCount.mockResolvedValue(1);

		const result = await prefetchProducts();
		const product = result?.products[0];

		expect(product?.description).toBeUndefined();
		expect(product?.shortDescription).toBeUndefined();
		expect(product?.compareAtPrice).toBeUndefined();
		expect(product?.sku).toBeUndefined();
		expect(product?.categoryId).toBeUndefined();
		expect(product?.images).toEqual([]);
		expect(product?.tags).toEqual([]);
		expect(product?.weight).toBeUndefined();
		expect(product?.weightUnit).toBeUndefined();
		expect(product?.trackInventory).toBe(true); // default
		expect(product?.allowBackorder).toBe(false); // default
		expect(product?.status).toBe("draft"); // default
		expect(product?.isFeatured).toBe(false); // default
	});

	it("falls back to row.createdAt when data.createdAt is absent", async () => {
		const row = makeProductRow({ createdAt: undefined, updatedAt: undefined });
		mockModuleDataFindMany.mockResolvedValue([row]);
		mockModuleDataCount.mockResolvedValue(1);

		const result = await prefetchProducts();
		const product = result?.products[0];

		expect(product?.createdAt).toBe(NOW.toISOString());
		expect(product?.updatedAt).toBe(LATER.toISOString());
	});

	it("applies pagination skip with page and limit options", async () => {
		mockModuleDataFindMany.mockResolvedValue([]);
		mockModuleDataCount.mockResolvedValue(100);

		await prefetchProducts({ page: 3, limit: 10 });

		expect(mockModuleDataFindMany).toHaveBeenCalledWith(
			expect.objectContaining({ take: 10, skip: 20 }),
		);
	});

	it("returns correct total from count", async () => {
		mockModuleDataFindMany.mockResolvedValue([]);
		mockModuleDataCount.mockResolvedValue(57);

		const result = await prefetchProducts();
		expect(result?.total).toBe(57);
	});
});

// ── prefetchCategories ──────────────────────────────────────────────

describe("prefetchCategories", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockModuleFindFirst.mockResolvedValue({ id: "module-1" });
	});

	it("returns null when the products module is not registered", async () => {
		mockModuleFindFirst.mockResolvedValue(null);
		const result = await prefetchCategories();
		expect(result).toBeNull();
	});

	it("maps DB rows to category objects", async () => {
		mockModuleDataFindMany.mockResolvedValue([
			{
				id: "cat-1",
				data: {
					name: "Footwear",
					slug: "footwear",
					description: "All shoes",
					parentId: undefined,
					image: "shoe.jpg",
					position: 1,
					isVisible: true,
				},
			},
		]);

		const result = await prefetchCategories();

		expect(result).not.toBeNull();
		expect(result?.categories).toHaveLength(1);
		const cat = result?.categories[0];
		expect(cat?.id).toBe("cat-1");
		expect(cat?.name).toBe("Footwear");
		expect(cat?.slug).toBe("footwear");
		expect(cat?.description).toBe("All shoes");
		expect(cat?.image).toBe("shoe.jpg");
		expect(cat?.position).toBe(1);
		expect(cat?.isVisible).toBe(true);
	});

	it("applies default values for missing optional category fields", async () => {
		mockModuleDataFindMany.mockResolvedValue([
			{
				id: "cat-2",
				data: { name: "Uncategorized", slug: "uncategorized" },
			},
		]);

		const result = await prefetchCategories();
		const cat = result?.categories[0];

		expect(cat?.description).toBeUndefined();
		expect(cat?.parentId).toBeUndefined();
		expect(cat?.image).toBeUndefined();
		expect(cat?.position).toBe(0); // default
		expect(cat?.isVisible).toBe(true); // default
	});

	it("returns an empty array when no categories exist", async () => {
		mockModuleDataFindMany.mockResolvedValue([]);
		const result = await prefetchCategories();
		expect(result?.categories).toEqual([]);
	});
});

// ── prefetchProductBySlug ───────────────────────────────────────────

describe("prefetchProductBySlug", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		mockModuleFindFirst.mockResolvedValue({ id: "module-1" });
	});

	it("returns null when module is not registered", async () => {
		mockModuleFindFirst.mockResolvedValue(null);
		const result = await prefetchProductBySlug("any-slug");
		expect(result).toBeNull();
	});

	it("returns null when no product matches the slug", async () => {
		mockModuleDataFindFirst.mockResolvedValue(null);
		const result = await prefetchProductBySlug("nonexistent-slug");
		expect(result).toBeNull();
	});

	it("returns null for inactive products", async () => {
		const row = makeProductRow({ status: "draft" });
		mockModuleDataFindFirst.mockResolvedValue(row);
		mockModuleDataFindMany.mockResolvedValue([]);

		const result = await prefetchProductBySlug("test-sneaker");
		expect(result).toBeNull();
	});

	it("returns the product with its id and an empty variants list", async () => {
		const row = makeProductRow({ status: "active" });
		mockModuleDataFindFirst.mockResolvedValue(row);
		mockModuleDataFindMany.mockResolvedValue([]);

		const result = await prefetchProductBySlug("test-sneaker");

		expect(result).not.toBeNull();
		expect(result?.id).toBe("prod-1");
		expect(result?.product.name).toBe("Test Sneaker");
		expect(result?.product.variants).toEqual([]);
	});

	it("attaches variants to the product", async () => {
		const row = makeProductRow({ status: "active" });
		const variantRow = {
			id: "var-1",
			data: {
				name: "Size 10",
				sku: "SKU-10",
				price: 8999,
				compareAtPrice: 9999,
				inventory: 5,
				options: { size: "10" },
				images: ["v1.jpg"],
				position: 0,
				productId: "prod-1",
				createdAt: NOW.toISOString(),
				updatedAt: LATER.toISOString(),
			},
			createdAt: NOW,
			updatedAt: LATER,
		};

		mockModuleDataFindFirst.mockResolvedValue(row);
		mockModuleDataFindMany.mockResolvedValue([variantRow]);

		const result = await prefetchProductBySlug("test-sneaker");
		const variant = result?.product.variants[0];

		expect(variant?.id).toBe("var-1");
		expect(variant?.name).toBe("Size 10");
		expect(variant?.sku).toBe("SKU-10");
		expect(variant?.price).toBe(8999);
		expect(variant?.options).toEqual({ size: "10" });
		expect(variant?.images).toEqual(["v1.jpg"]);
		expect(variant?.productId).toBe("prod-1");
	});

	it("handles variants with missing optional fields", async () => {
		const row = makeProductRow({ status: "active" });
		const variantRow = {
			id: "var-2",
			data: { name: "Default", price: 100 },
			createdAt: NOW,
			updatedAt: LATER,
		};

		mockModuleDataFindFirst.mockResolvedValue(row);
		mockModuleDataFindMany.mockResolvedValue([variantRow]);

		const result = await prefetchProductBySlug("test-sneaker");
		const variant = result?.product.variants[0];

		expect(variant?.sku).toBeUndefined();
		expect(variant?.compareAtPrice).toBeUndefined();
		expect(variant?.options).toEqual({});
		expect(variant?.images).toEqual([]);
	});
});
