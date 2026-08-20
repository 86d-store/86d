import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSitemapController } from "../service-impl";

/**
 * Store endpoint integration tests for the sitemap module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. generate-xml: generates XML sitemap content
 * 2. list-entries: lists sitemap entries
 * 3. get-config: returns sitemap configuration
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGenerateXml(data: DataService) {
	const controller = createSitemapController(data);
	const xml = await controller.generateXml();
	return { xml };
}

async function simulateListEntries(
	data: DataService,
	query: { source?: string; take?: number; skip?: number } = {},
) {
	const controller = createSitemapController(data);
	const entries = await controller.listEntries(query);
	return { entries };
}

async function simulateGetConfig(data: DataService) {
	const controller = createSitemapController(data);
	const config = await controller.getConfig();
	return { config };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: generate xml sitemap", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("generates valid XML sitemap", async () => {
		const ctrl = createSitemapController(data);
		await ctrl.addEntry({
			path: "/products/widget",
			changefreq: "weekly",
			priority: 0.8,
		});

		const result = await simulateGenerateXml(data);

		expect(result.xml).toContain("<?xml");
		expect(result.xml).toContain("/products/widget");
	});

	it("generates empty sitemap when no entries", async () => {
		const result = await simulateGenerateXml(data);

		expect(result.xml).toContain("<?xml");
	});
});

describe("store endpoint: list entries", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns all sitemap entries", async () => {
		const ctrl = createSitemapController(data);
		await ctrl.addEntry({ path: "/page-1" });
		await ctrl.addEntry({ path: "/page-2" });

		const result = await simulateListEntries(data);

		expect(result.entries).toHaveLength(2);
	});

	it("filters entries by source", async () => {
		const ctrl = createSitemapController(data);
		await ctrl.addEntry({ path: "/manual-page" });
		await ctrl.regenerate({
			products: [{ slug: "widget" }],
		});

		const result = await simulateListEntries(data, { source: "product" });

		expect(result.entries.length).toBeGreaterThanOrEqual(1);
	});

	it("returns empty when no entries exist", async () => {
		const result = await simulateListEntries(data);

		expect(result.entries).toHaveLength(0);
	});
});

describe("store endpoint: get config", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns sitemap configuration", async () => {
		const result = await simulateGetConfig(data);

		expect(result.config).toBeDefined();
	});

	it("returns updated config after modification", async () => {
		const ctrl = createSitemapController(data);
		await ctrl.updateConfig({ defaultChangeFreq: "daily" });

		const result = await simulateGetConfig(data);

		expect(result.config.defaultChangeFreq).toBe("daily");
	});
});
