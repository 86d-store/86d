import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createSeoController } from "../service-impl";

/**
 * Store endpoint integration tests for the seo module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-meta-by-path: returns meta tags for a URL path
 * 2. get-sitemap-entries: returns sitemap entry data
 * 3. get-redirect-by-path: resolves SEO redirects
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateGetMetaByPath(data: DataService, path: string) {
	const controller = createSeoController(data);
	const meta = await controller.getMetaTagByPath(path);
	if (!meta) {
		return { error: "No meta tags found", status: 404 };
	}
	return { meta };
}

async function simulateGetSitemapEntries(data: DataService) {
	const controller = createSeoController(data);
	const entries = await controller.getSitemapEntries();
	return { entries };
}

async function simulateGetRedirectByPath(data: DataService, path: string) {
	const controller = createSeoController(data);
	const redirect = await controller.getRedirectByPath(path);
	if (!redirect) {
		return { error: "No redirect found", status: 404 };
	}
	return { redirect };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: get meta by path", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns meta tags for a matching path", async () => {
		const ctrl = createSeoController(data);
		await ctrl.upsertMetaTag({
			path: "/about",
			title: "About Us | My Store",
			description: "Learn about our company",
		});

		const result = await simulateGetMetaByPath(data, "/about");

		expect("meta" in result).toBe(true);
		if ("meta" in result) {
			expect(result.meta.title).toBe("About Us | My Store");
			expect(result.meta.description).toBe("Learn about our company");
		}
	});

	it("returns 404 for path with no meta tags", async () => {
		const result = await simulateGetMetaByPath(data, "/unknown");

		expect(result).toEqual({ error: "No meta tags found", status: 404 });
	});
});

describe("store endpoint: get sitemap entries", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns sitemap entries from meta tags", async () => {
		const ctrl = createSeoController(data);
		await ctrl.upsertMetaTag({
			path: "/products",
			title: "Products",
		});
		await ctrl.upsertMetaTag({
			path: "/about",
			title: "About",
		});

		const result = await simulateGetSitemapEntries(data);

		expect(result.entries.length).toBeGreaterThanOrEqual(2);
	});

	it("returns empty when no entries", async () => {
		const result = await simulateGetSitemapEntries(data);

		expect(result.entries).toHaveLength(0);
	});
});

describe("store endpoint: get redirect by path", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns a redirect for a matching path", async () => {
		const ctrl = createSeoController(data);
		await ctrl.createRedirect({
			fromPath: "/old-blog",
			toPath: "/blog",
			statusCode: 301,
		});

		const result = await simulateGetRedirectByPath(data, "/old-blog");

		expect("redirect" in result).toBe(true);
		if ("redirect" in result) {
			expect(result.redirect.toPath).toBe("/blog");
		}
	});

	it("returns 404 for unmatched path", async () => {
		const result = await simulateGetRedirectByPath(data, "/nothing");

		expect(result).toEqual({ error: "No redirect found", status: 404 });
	});
});
