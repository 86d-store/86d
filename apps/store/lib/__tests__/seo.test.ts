import { describe, expect, it, vi } from "vitest";

// Mock all external dependencies so the module can be imported
vi.mock("db", () => ({ db: {} }));
vi.mock("env", () => ({ default: {} }));
vi.mock("@86d-app/sdk/get-store-config", () => ({ getStoreConfig: vi.fn() }));
vi.mock("react", () => ({ cache: (fn: unknown) => fn }));
vi.mock("../template-path", () => ({ resolveTemplatePath: vi.fn(() => "/") }));
vi.mock("utils/url", () => ({
	getBaseUrl: () => "https://shop.example.com",
}));

import { buildCollectionJsonLd, buildProductJsonLd } from "../seo";

// ── buildProductJsonLd ──────────────────────────────────────────────

describe("buildProductJsonLd", () => {
	const base = {
		name: "Classic T-Shirt",
		slug: "classic-tee",
		description: null,
		shortDescription: null,
		price: 29.99,
		compareAtPrice: null,
		images: [] as { url: string; alt?: string }[],
		status: "active",
		sku: null,
		updatedAt: "2026-01-15T12:00:00.000Z",
	};

	it("includes required schema.org fields", () => {
		const ld = buildProductJsonLd(base) as Record<string, unknown>;

		expect(ld["@context"]).toBe("https://schema.org");
		expect(ld["@type"]).toBe("Product");
		expect(ld.name).toBe("Classic T-Shirt");
		expect(ld.url).toBe("https://shop.example.com/products/classic-tee");
	});

	it("formats price with two decimals", () => {
		const ld = buildProductJsonLd(base) as Record<string, unknown>;
		const offers = ld.offers as Record<string, unknown>;

		expect(offers["@type"]).toBe("Offer");
		expect(offers.price).toBe("29.99");
		expect(offers.priceCurrency).toBe("USD");
		expect(offers.availability).toBe("https://schema.org/InStock");
		expect(offers.url).toBe("https://shop.example.com/products/classic-tee");
	});

	it("formats whole-number price correctly", () => {
		const ld = buildProductJsonLd({ ...base, price: 100 }) as Record<
			string,
			unknown
		>;
		const offers = ld.offers as Record<string, unknown>;

		expect(offers.price).toBe("100.00");
	});

	it("includes description when present", () => {
		const ld = buildProductJsonLd({
			...base,
			description: "A comfortable cotton tee",
		}) as Record<string, unknown>;

		expect(ld.description).toBe("A comfortable cotton tee");
	});

	it("excludes description when null", () => {
		const ld = buildProductJsonLd(base) as Record<string, unknown>;

		expect(ld).not.toHaveProperty("description");
	});

	it("includes image URLs when images exist", () => {
		const ld = buildProductJsonLd({
			...base,
			images: [
				{ url: "https://cdn.example.com/tee-front.jpg", alt: "Front" },
				{ url: "https://cdn.example.com/tee-back.jpg" },
			],
		}) as Record<string, unknown>;

		expect(ld.image).toEqual([
			"https://cdn.example.com/tee-front.jpg",
			"https://cdn.example.com/tee-back.jpg",
		]);
	});

	it("excludes image when array is empty", () => {
		const ld = buildProductJsonLd(base) as Record<string, unknown>;

		expect(ld).not.toHaveProperty("image");
	});

	it("includes sku when present", () => {
		const ld = buildProductJsonLd({
			...base,
			sku: "TEE-BLK-M",
		}) as Record<string, unknown>;

		expect(ld.sku).toBe("TEE-BLK-M");
	});

	it("excludes sku when null", () => {
		const ld = buildProductJsonLd(base) as Record<string, unknown>;

		expect(ld).not.toHaveProperty("sku");
	});

	it("handles zero price", () => {
		const ld = buildProductJsonLd({ ...base, price: 0 }) as Record<
			string,
			unknown
		>;
		const offers = ld.offers as Record<string, unknown>;

		expect(offers.price).toBe("0.00");
	});

	it("handles full product with all fields", () => {
		const ld = buildProductJsonLd({
			...base,
			description: "Premium cotton tee",
			images: [{ url: "https://cdn.example.com/img.jpg" }],
			sku: "TEE-001",
			price: 49.5,
		}) as Record<string, unknown>;

		expect(ld.name).toBe("Classic T-Shirt");
		expect(ld.description).toBe("Premium cotton tee");
		expect(ld.image).toEqual(["https://cdn.example.com/img.jpg"]);
		expect(ld.sku).toBe("TEE-001");
		expect((ld.offers as Record<string, unknown>).price).toBe("49.50");
	});
});

// ── buildCollectionJsonLd ───────────────────────────────────────────

describe("buildCollectionJsonLd", () => {
	const base = {
		name: "Summer Collection",
		slug: "summer",
		description: null,
		image: null,
		updatedAt: "2026-06-01T00:00:00.000Z",
	};

	it("includes required schema.org fields", () => {
		const ld = buildCollectionJsonLd(base) as Record<string, unknown>;

		expect(ld["@context"]).toBe("https://schema.org");
		expect(ld["@type"]).toBe("CollectionPage");
		expect(ld.name).toBe("Summer Collection");
		expect(ld.url).toBe("https://shop.example.com/collections/summer");
	});

	it("includes description when present", () => {
		const ld = buildCollectionJsonLd({
			...base,
			description: "Our best summer picks",
		}) as Record<string, unknown>;

		expect(ld.description).toBe("Our best summer picks");
	});

	it("excludes description when null", () => {
		const ld = buildCollectionJsonLd(base) as Record<string, unknown>;

		expect(ld).not.toHaveProperty("description");
	});

	it("includes image when present", () => {
		const ld = buildCollectionJsonLd({
			...base,
			image: "https://cdn.example.com/summer-banner.jpg",
		}) as Record<string, unknown>;

		expect(ld.image).toBe("https://cdn.example.com/summer-banner.jpg");
	});

	it("excludes image when null", () => {
		const ld = buildCollectionJsonLd(base) as Record<string, unknown>;

		expect(ld).not.toHaveProperty("image");
	});

	it("handles full collection with all fields", () => {
		const ld = buildCollectionJsonLd({
			...base,
			description: "Curated picks for warm weather",
			image: "https://cdn.example.com/banner.jpg",
		}) as Record<string, unknown>;

		expect(ld.name).toBe("Summer Collection");
		expect(ld.description).toBe("Curated picks for warm weather");
		expect(ld.image).toBe("https://cdn.example.com/banner.jpg");
		expect(ld.url).toBe("https://shop.example.com/collections/summer");
	});
});
