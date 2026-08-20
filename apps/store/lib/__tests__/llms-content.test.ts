import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const mockFetchProductsForLlms = vi.hoisted(() => vi.fn());
const mockFetchCollectionsForLlms = vi.hoisted(() => vi.fn());
const mockFetchBlogPostsForLlms = vi.hoisted(() => vi.fn());
const mockGetStoreName = vi.hoisted(() => vi.fn());
vi.mock("~/lib/seo", () => ({
	fetchProductsForLlms: mockFetchProductsForLlms,
	fetchCollectionsForLlms: mockFetchCollectionsForLlms,
	fetchBlogPostsForLlms: mockFetchBlogPostsForLlms,
	getStoreName: mockGetStoreName,
}));

const mockRenderLlmsFullMarkdown = vi.hoisted(() => vi.fn());
vi.mock("lib/llms-content", () => ({
	renderLlmsFullMarkdown: mockRenderLlmsFullMarkdown,
}));

vi.mock("utils/url", () => ({
	getBaseUrl: () => "https://example.mystore.com",
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import {
	fetchLlmsFullContent,
	generateLlmsFullMarkdown,
} from "../llms-content";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mockProducts = [
	{ id: "p1", name: "Sneaker", price: 9900 },
	{ id: "p2", name: "T-Shirt", price: 2500 },
];
const mockCollections = [{ id: "c1", name: "Summer Sale" }];
const mockBlogPosts = [{ id: "b1", title: "Top 10 Styles" }];

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
	vi.clearAllMocks();
	mockFetchProductsForLlms.mockResolvedValue(mockProducts);
	mockFetchCollectionsForLlms.mockResolvedValue(mockCollections);
	mockFetchBlogPostsForLlms.mockResolvedValue(mockBlogPosts);
	mockGetStoreName.mockResolvedValue("Test Store");
	mockRenderLlmsFullMarkdown.mockReturnValue("# Test Store\n\n## Products");
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("fetchLlmsFullContent", () => {
	it("fetches products, collections, and blog posts in parallel", async () => {
		const content = await fetchLlmsFullContent();

		expect(mockFetchProductsForLlms).toHaveBeenCalledTimes(1);
		expect(mockFetchCollectionsForLlms).toHaveBeenCalledTimes(1);
		expect(mockFetchBlogPostsForLlms).toHaveBeenCalledTimes(1);

		expect(content).toEqual({
			products: mockProducts,
			collections: mockCollections,
			blogPosts: mockBlogPosts,
		});
	});

	it("returns products from the SEO module", async () => {
		const content = await fetchLlmsFullContent();
		expect(content.products).toHaveLength(2);
		expect(content.products[0].name).toBe("Sneaker");
	});

	it("returns empty arrays when queries return no data", async () => {
		mockFetchProductsForLlms.mockResolvedValue([]);
		mockFetchCollectionsForLlms.mockResolvedValue([]);
		mockFetchBlogPostsForLlms.mockResolvedValue([]);

		const content = await fetchLlmsFullContent();

		expect(content.products).toHaveLength(0);
		expect(content.collections).toHaveLength(0);
		expect(content.blogPosts).toHaveLength(0);
	});
});

describe("generateLlmsFullMarkdown", () => {
	it("calls renderLlmsFullMarkdown with content, store name, and base URL", async () => {
		await generateLlmsFullMarkdown();

		expect(mockRenderLlmsFullMarkdown).toHaveBeenCalledWith(
			{
				products: mockProducts,
				collections: mockCollections,
				blogPosts: mockBlogPosts,
			},
			"Test Store",
			"https://example.mystore.com",
		);
	});

	it("returns the rendered markdown string", async () => {
		mockRenderLlmsFullMarkdown.mockReturnValue(
			"# My Store\n\n## Products\n\n- Item",
		);

		const result = await generateLlmsFullMarkdown();

		expect(result).toBe("# My Store\n\n## Products\n\n- Item");
	});

	it("fetches content and store name concurrently", async () => {
		let productsFetched = false;
		let storeNameFetched = false;

		mockFetchProductsForLlms.mockImplementation(async () => {
			productsFetched = true;
			return mockProducts;
		});
		mockGetStoreName.mockImplementation(async () => {
			storeNameFetched = true;
			return "Test Store";
		});

		await generateLlmsFullMarkdown();

		expect(productsFetched).toBe(true);
		expect(storeNameFetched).toBe(true);
	});
});
