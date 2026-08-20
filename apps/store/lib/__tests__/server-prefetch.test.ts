import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFindMany = vi.hoisted(() => vi.fn());
const mockCount = vi.hoisted(() => vi.fn());
const mockGetModuleDataService = vi.hoisted(() => vi.fn());

vi.mock("react", () => ({
	cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("../module-data-access", () => ({
	getModuleDataService: mockGetModuleDataService,
}));

import {
	prefetchCategories,
	prefetchProductBySlug,
	prefetchProducts,
} from "../server-prefetch";

beforeEach(() => {
	vi.clearAllMocks();
	mockGetModuleDataService.mockResolvedValue({
		findMany: mockFindMany,
		count: mockCount,
	});
});

describe("server-prefetch", () => {
	it("returns null when the products Module is unavailable", async () => {
		mockGetModuleDataService.mockResolvedValueOnce(null);
		expect(await prefetchProducts()).toBeNull();
	});

	it("prefeches active products through ModuleDataService", async () => {
		mockFindMany.mockResolvedValueOnce([
			{
				id: "prod-1",
				name: "Coat",
				slug: "coat",
				status: "active",
				price: 100,
				inventory: 1,
				trackInventory: true,
				allowBackorder: false,
				images: [],
				tags: [],
				isFeatured: false,
				createdAt: "2025-01-01T00:00:00.000Z",
				updatedAt: "2025-01-01T00:00:00.000Z",
			},
		]);
		mockCount.mockResolvedValueOnce(1);
		const result = await prefetchProducts({ page: 1, limit: 12 });
		expect(result?.total).toBe(1);
		expect(result?.products[0]?.slug).toBe("coat");
	});

	it("prefeches a product by slug with variants", async () => {
		mockFindMany
			.mockResolvedValueOnce([
				{
					id: "prod-1",
					name: "Coat",
					slug: "coat",
					status: "active",
					price: 100,
					inventory: 1,
					trackInventory: true,
					allowBackorder: false,
					images: [],
					tags: [],
					isFeatured: false,
					createdAt: "2025-01-01T00:00:00.000Z",
					updatedAt: "2025-01-01T00:00:00.000Z",
				},
			])
			.mockResolvedValueOnce([]);
		const result = await prefetchProductBySlug("coat");
		expect(result?.id).toBe("prod-1");
		expect(result?.product.variants).toEqual([]);
	});

	it("prefeches visible categories", async () => {
		mockFindMany.mockResolvedValueOnce([
			{
				id: "cat-1",
				name: "Outerwear",
				slug: "outerwear",
				position: 0,
				isVisible: true,
			},
		]);
		const result = await prefetchCategories();
		expect(result?.categories).toHaveLength(1);
	});
});
