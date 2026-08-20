import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getBaseUrl: vi.fn(() => "https://store.example.com"),
	fetchProductSlugsForSitemap: vi.fn(),
	fetchCollectionSlugsForSitemap: vi.fn(),
	fetchBlogPostSlugsForSitemap: vi.fn(),
	fetchFlashSaleSlugsForSitemap: vi.fn(),
	fetchAuctionIdsForSitemap: vi.fn(),
	fetchPreorderCampaignIdsForSitemap: vi.fn(),
}));

vi.mock("utils/url", () => ({
	getBaseUrl: mocks.getBaseUrl,
}));

vi.mock("../../lib/seo", () => ({
	fetchProductSlugsForSitemap: mocks.fetchProductSlugsForSitemap,
	fetchCollectionSlugsForSitemap: mocks.fetchCollectionSlugsForSitemap,
	fetchBlogPostSlugsForSitemap: mocks.fetchBlogPostSlugsForSitemap,
	fetchFlashSaleSlugsForSitemap: mocks.fetchFlashSaleSlugsForSitemap,
	fetchAuctionIdsForSitemap: mocks.fetchAuctionIdsForSitemap,
	fetchPreorderCampaignIdsForSitemap: mocks.fetchPreorderCampaignIdsForSitemap,
}));

const { default: sitemap } = await import("../sitemap");

const BASE = "https://store.example.com";

function defaultMocks() {
	mocks.fetchProductSlugsForSitemap.mockResolvedValue([]);
	mocks.fetchCollectionSlugsForSitemap.mockResolvedValue([]);
	mocks.fetchBlogPostSlugsForSitemap.mockResolvedValue([]);
	mocks.fetchFlashSaleSlugsForSitemap.mockResolvedValue([]);
	mocks.fetchAuctionIdsForSitemap.mockResolvedValue([]);
	mocks.fetchPreorderCampaignIdsForSitemap.mockResolvedValue([]);
}

describe("sitemap()", () => {
	it("includes the homepage with highest priority", async () => {
		defaultMocks();
		const entries = await sitemap();
		const home = entries.find((e) => e.url === BASE);
		expect(home).toBeDefined();
		expect(home?.priority).toBe(1);
		expect(home?.changeFrequency).toBe("daily");
	});

	it("includes all expected static pages", async () => {
		defaultMocks();
		const entries = await sitemap();
		const urls = entries.map((e) => e.url);
		expect(urls).toContain(`${BASE}/products`);
		expect(urls).toContain(`${BASE}/collections`);
		expect(urls).toContain(`${BASE}/search`);
		expect(urls).toContain(`${BASE}/about`);
		expect(urls).toContain(`${BASE}/contact`);
		expect(urls).toContain(`${BASE}/blog`);
		expect(urls).toContain(`${BASE}/gift-cards`);
		expect(urls).toContain(`${BASE}/terms`);
		expect(urls).toContain(`${BASE}/privacy`);
	});

	it("appends product dynamic pages with correct structure", async () => {
		const updatedAt = new Date("2026-01-10");
		mocks.fetchProductSlugsForSitemap.mockResolvedValue([
			{ slug: "blue-sneaker", updatedAt },
			{ slug: "red-hat", updatedAt },
		]);
		mocks.fetchCollectionSlugsForSitemap.mockResolvedValue([]);
		mocks.fetchBlogPostSlugsForSitemap.mockResolvedValue([]);
		mocks.fetchFlashSaleSlugsForSitemap.mockResolvedValue([]);
		mocks.fetchAuctionIdsForSitemap.mockResolvedValue([]);
		mocks.fetchPreorderCampaignIdsForSitemap.mockResolvedValue([]);

		const entries = await sitemap();
		expect(entries.some((e) => e.url === `${BASE}/products/blue-sneaker`)).toBe(
			true,
		);
		expect(entries.some((e) => e.url === `${BASE}/products/red-hat`)).toBe(
			true,
		);
		const product = entries.find(
			(e) => e.url === `${BASE}/products/blue-sneaker`,
		);
		expect(product?.changeFrequency).toBe("weekly");
		expect(product?.priority).toBe(0.8);
		expect(product?.lastModified).toBe(updatedAt);
	});

	it("appends collection dynamic pages with correct structure", async () => {
		const updatedAt = new Date("2026-02-15");
		mocks.fetchProductSlugsForSitemap.mockResolvedValue([]);
		mocks.fetchCollectionSlugsForSitemap.mockResolvedValue([
			{ slug: "summer-sale", updatedAt },
		]);
		mocks.fetchBlogPostSlugsForSitemap.mockResolvedValue([]);
		mocks.fetchFlashSaleSlugsForSitemap.mockResolvedValue([]);
		mocks.fetchAuctionIdsForSitemap.mockResolvedValue([]);
		mocks.fetchPreorderCampaignIdsForSitemap.mockResolvedValue([]);

		const entries = await sitemap();
		const col = entries.find(
			(e) => e.url === `${BASE}/collections/summer-sale`,
		);
		expect(col).toBeDefined();
		expect(col?.priority).toBe(0.7);
	});

	it("appends blog dynamic pages with correct structure", async () => {
		const updatedAt = new Date("2026-03-01");
		mocks.fetchProductSlugsForSitemap.mockResolvedValue([]);
		mocks.fetchCollectionSlugsForSitemap.mockResolvedValue([]);
		mocks.fetchBlogPostSlugsForSitemap.mockResolvedValue([
			{ slug: "how-to-style", updatedAt },
		]);
		mocks.fetchFlashSaleSlugsForSitemap.mockResolvedValue([]);
		mocks.fetchAuctionIdsForSitemap.mockResolvedValue([]);
		mocks.fetchPreorderCampaignIdsForSitemap.mockResolvedValue([]);

		const entries = await sitemap();
		const post = entries.find((e) => e.url === `${BASE}/blog/how-to-style`);
		expect(post).toBeDefined();
		expect(post?.priority).toBe(0.6);
		expect(post?.changeFrequency).toBe("weekly");
	});

	it("appends flash sale pages when active sales exist", async () => {
		const updatedAt = new Date("2026-05-01");
		defaultMocks();
		mocks.fetchFlashSaleSlugsForSitemap.mockResolvedValue([
			{ slug: "weekend-edit", updatedAt },
		]);

		const entries = await sitemap();
		const urls = entries.map((e) => e.url);

		expect(urls).toContain(`${BASE}/flash-sales`);
		expect(urls).toContain(`${BASE}/flash-sales/weekend-edit`);
		const detail = entries.find(
			(e) => e.url === `${BASE}/flash-sales/weekend-edit`,
		);
		expect(detail?.changeFrequency).toBe("hourly");
		expect(detail?.priority).toBe(0.85);
	});

	it("does not include flash-sales when no active sales", async () => {
		defaultMocks();
		const entries = await sitemap();
		expect(entries.some((e) => e.url.includes("/flash-sales"))).toBe(false);
	});

	it("appends auction pages when active auctions exist", async () => {
		const updatedAt = new Date("2026-05-01");
		defaultMocks();
		mocks.fetchAuctionIdsForSitemap.mockResolvedValue([
			{ id: "auction-123", updatedAt },
		]);

		const entries = await sitemap();
		const urls = entries.map((e) => e.url);

		expect(urls).toContain(`${BASE}/auctions`);
		expect(urls).toContain(`${BASE}/auctions/auction-123`);
	});

	it("does not include /auctions when no active auctions", async () => {
		defaultMocks();
		const entries = await sitemap();
		expect(entries.some((e) => e.url.includes("/auctions"))).toBe(false);
	});

	it("appends preorder pages when campaigns exist", async () => {
		const updatedAt = new Date("2026-05-01");
		defaultMocks();
		mocks.fetchPreorderCampaignIdsForSitemap.mockResolvedValue([
			{ id: "campaign-456", updatedAt },
		]);

		const entries = await sitemap();
		const urls = entries.map((e) => e.url);

		expect(urls).toContain(`${BASE}/preorders`);
		expect(urls).toContain(`${BASE}/preorders/campaign-456`);
	});

	it("degrades gracefully when DB fetch throws — returns only static pages", async () => {
		mocks.fetchProductSlugsForSitemap.mockRejectedValue(new Error("DB down"));
		mocks.fetchCollectionSlugsForSitemap.mockRejectedValue(
			new Error("DB down"),
		);
		mocks.fetchBlogPostSlugsForSitemap.mockRejectedValue(new Error("DB down"));
		mocks.fetchFlashSaleSlugsForSitemap.mockRejectedValue(new Error("DB down"));
		mocks.fetchAuctionIdsForSitemap.mockRejectedValue(new Error("DB down"));
		mocks.fetchPreorderCampaignIdsForSitemap.mockRejectedValue(
			new Error("DB down"),
		);

		const entries = await sitemap();

		// Static pages still present
		expect(entries.length).toBeGreaterThanOrEqual(10);
		expect(entries.find((e) => e.url === BASE)).toBeDefined();

		// No dynamic pages
		expect(entries.some((e) => e.url.includes("/products/"))).toBe(false);
		expect(entries.some((e) => e.url.includes("/collections/"))).toBe(false);
		expect(entries.some((e) => e.url.includes("/blog/"))).toBe(false);
		expect(entries.some((e) => e.url.includes("/flash-sales/"))).toBe(false);
	});

	it("combines static and all dynamic pages in the output", async () => {
		mocks.fetchProductSlugsForSitemap.mockResolvedValue([
			{ slug: "widget", updatedAt: new Date() },
		]);
		mocks.fetchCollectionSlugsForSitemap.mockResolvedValue([
			{ slug: "new-arrivals", updatedAt: new Date() },
		]);
		mocks.fetchBlogPostSlugsForSitemap.mockResolvedValue([
			{ slug: "news", updatedAt: new Date() },
		]);
		mocks.fetchFlashSaleSlugsForSitemap.mockResolvedValue([
			{ slug: "flash-1", updatedAt: new Date() },
		]);
		mocks.fetchAuctionIdsForSitemap.mockResolvedValue([
			{ id: "auction-1", updatedAt: new Date() },
		]);
		mocks.fetchPreorderCampaignIdsForSitemap.mockResolvedValue([
			{ id: "campaign-1", updatedAt: new Date() },
		]);

		const entries = await sitemap();
		const urls = entries.map((e) => e.url);

		// static
		expect(urls).toContain(BASE);
		expect(urls).toContain(`${BASE}/products`);
		// dynamic
		expect(urls).toContain(`${BASE}/products/widget`);
		expect(urls).toContain(`${BASE}/collections/new-arrivals`);
		expect(urls).toContain(`${BASE}/blog/news`);
		expect(urls).toContain(`${BASE}/flash-sales`);
		expect(urls).toContain(`${BASE}/flash-sales/flash-1`);
		expect(urls).toContain(`${BASE}/auctions`);
		expect(urls).toContain(`${BASE}/auctions/auction-1`);
		expect(urls).toContain(`${BASE}/preorders`);
		expect(urls).toContain(`${BASE}/preorders/campaign-1`);
	});

	it("uses the base URL from getBaseUrl for all entries", async () => {
		mocks.getBaseUrl.mockReturnValue("https://custom-store.com");
		defaultMocks();

		const entries = await sitemap();
		expect(
			entries.every(
				(e) => new URL(e.url).origin === "https://custom-store.com",
			),
		).toBe(true);
	});
});
