import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createMediaController } from "../service-impl";

/**
 * Store endpoint integration tests for the media module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-assets: returns assets with folder/tag/search filtering
 * 2. get-asset: returns a single asset by ID
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListAssets(
	data: DataService,
	query: {
		folder?: string;
		tag?: string;
		search?: string;
		mimeType?: string;
		take?: number;
		skip?: number;
	} = {},
) {
	const controller = createMediaController(data);
	const assets = await controller.listAssets(query);
	return { assets };
}

async function simulateGetAsset(data: DataService, assetId: string) {
	const controller = createMediaController(data);
	const asset = await controller.getAsset(assetId);
	if (!asset) {
		return { error: "Asset not found", status: 404 };
	}
	return { asset };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list assets", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns all assets", async () => {
		const ctrl = createMediaController(data);
		await ctrl.createAsset({
			name: "logo.png",
			altText: "Company logo",
			url: "https://cdn.example.com/logo.png",
			mimeType: "image/png",
			size: 5000,
			width: 200,
			height: 200,
		});
		await ctrl.createAsset({
			name: "banner.jpg",
			altText: "Hero banner",
			url: "https://cdn.example.com/banner.jpg",
			mimeType: "image/jpeg",
			size: 50000,
			width: 1920,
			height: 600,
		});

		const result = await simulateListAssets(data);

		expect(result.assets).toHaveLength(2);
	});

	it("filters by folder", async () => {
		const ctrl = createMediaController(data);
		await ctrl.createAsset({
			name: "product-1.png",
			altText: "Product 1",
			url: "https://cdn.example.com/product-1.png",
			mimeType: "image/png",
			size: 3000,
			width: 400,
			height: 400,
			folder: "products",
		});
		await ctrl.createAsset({
			name: "hero.png",
			altText: "Hero",
			url: "https://cdn.example.com/hero.png",
			mimeType: "image/png",
			size: 8000,
			width: 1200,
			height: 400,
			folder: "banners",
		});

		const result = await simulateListAssets(data, { folder: "products" });

		expect(result.assets).toHaveLength(1);
		expect(result.assets[0].name).toBe("product-1.png");
	});

	it("filters by tag", async () => {
		const ctrl = createMediaController(data);
		await ctrl.createAsset({
			name: "summer.png",
			altText: "Summer collection",
			url: "https://cdn.example.com/summer.png",
			mimeType: "image/png",
			size: 4000,
			width: 600,
			height: 400,
			tags: ["seasonal", "summer"],
		});
		await ctrl.createAsset({
			name: "winter.png",
			altText: "Winter collection",
			url: "https://cdn.example.com/winter.png",
			mimeType: "image/png",
			size: 4500,
			width: 600,
			height: 400,
			tags: ["seasonal", "winter"],
		});

		const result = await simulateListAssets(data, { tag: "summer" });

		expect(result.assets).toHaveLength(1);
		expect(result.assets[0].name).toBe("summer.png");
	});

	it("searches by name", async () => {
		const ctrl = createMediaController(data);
		await ctrl.createAsset({
			name: "product-hero.png",
			altText: "Product hero image",
			url: "https://cdn.example.com/product-hero.png",
			mimeType: "image/png",
			size: 7000,
			width: 800,
			height: 600,
		});
		await ctrl.createAsset({
			name: "logo.svg",
			altText: "Logo",
			url: "https://cdn.example.com/logo.svg",
			mimeType: "image/svg+xml",
			size: 1200,
			width: 100,
			height: 100,
		});

		const result = await simulateListAssets(data, { search: "hero" });

		expect(result.assets).toHaveLength(1);
		expect(result.assets[0].name).toBe("product-hero.png");
	});

	it("filters by mime type", async () => {
		const ctrl = createMediaController(data);
		await ctrl.createAsset({
			name: "photo.jpg",
			altText: "Photo",
			url: "https://cdn.example.com/photo.jpg",
			mimeType: "image/jpeg",
			size: 12000,
			width: 1024,
			height: 768,
		});
		await ctrl.createAsset({
			name: "doc.pdf",
			altText: "Document",
			url: "https://cdn.example.com/doc.pdf",
			mimeType: "application/pdf",
			size: 25000,
			width: 0,
			height: 0,
		});

		const result = await simulateListAssets(data, {
			mimeType: "image/jpeg",
		});

		expect(result.assets).toHaveLength(1);
		expect(result.assets[0].name).toBe("photo.jpg");
	});

	it("returns empty when no assets exist", async () => {
		const result = await simulateListAssets(data);

		expect(result.assets).toHaveLength(0);
	});
});

describe("store endpoint: get asset", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns an asset by ID", async () => {
		const ctrl = createMediaController(data);
		const asset = await ctrl.createAsset({
			name: "banner.png",
			altText: "Store banner",
			url: "https://cdn.example.com/banner.png",
			mimeType: "image/png",
			size: 15000,
			width: 1920,
			height: 600,
		});

		const result = await simulateGetAsset(data, asset.id);

		expect("asset" in result).toBe(true);
		if ("asset" in result) {
			expect(result.asset.name).toBe("banner.png");
			expect(result.asset.mimeType).toBe("image/png");
		}
	});

	it("returns 404 for nonexistent asset", async () => {
		const result = await simulateGetAsset(data, "ghost_asset");

		expect(result).toEqual({ error: "Asset not found", status: 404 });
	});
});
