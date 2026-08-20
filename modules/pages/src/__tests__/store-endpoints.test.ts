import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createPagesController } from "../service-impl";

/**
 * Store endpoint integration tests for the pages module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-pages: returns published pages
 * 2. get-navigation: returns published pages marked for navigation
 * 3. get-page-by-slug: returns a single published page by slug
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListPages(
	data: DataService,
	query: { take?: number; skip?: number } = {},
) {
	const controller = createPagesController(data);
	const pages = await controller.listPages({
		status: "published",
		...query,
	});
	return { pages };
}

async function simulateGetNavigation(data: DataService) {
	const controller = createPagesController(data);
	const pages = await controller.getNavigationPages();
	return { pages };
}

async function simulateGetPageBySlug(data: DataService, slug: string) {
	const controller = createPagesController(data);
	const page = await controller.getPageBySlug(slug);
	if (!page || page.status !== "published") {
		return { error: "Page not found", status: 404 };
	}
	return { page };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list pages — published only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only published pages", async () => {
		const ctrl = createPagesController(data);
		await ctrl.createPage({
			title: "About Us",
			slug: "about",
			content: "We are a company.",
			status: "published",
		});
		await ctrl.createPage({
			title: "Draft Page",
			slug: "draft",
			content: "Work in progress.",
			status: "draft",
		});

		const result = await simulateListPages(data);

		expect(result.pages).toHaveLength(1);
		expect(result.pages[0].title).toBe("About Us");
	});

	it("returns empty when no published pages exist", async () => {
		const result = await simulateListPages(data);

		expect(result.pages).toHaveLength(0);
	});

	it("supports pagination", async () => {
		const ctrl = createPagesController(data);
		for (let i = 0; i < 5; i++) {
			await ctrl.createPage({
				title: `Page ${i}`,
				slug: `page-${i}`,
				content: `Content ${i}`,
				status: "published",
			});
		}

		const result = await simulateListPages(data, { take: 2 });

		expect(result.pages).toHaveLength(2);
	});
});

describe("store endpoint: get navigation — published nav pages", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only published pages with showInNavigation", async () => {
		const ctrl = createPagesController(data);
		await ctrl.createPage({
			title: "About",
			slug: "about",
			content: "About us page.",
			status: "published",
			showInNavigation: true,
			position: 1,
		});
		await ctrl.createPage({
			title: "Privacy Policy",
			slug: "privacy",
			content: "Privacy details.",
			status: "published",
			showInNavigation: false,
		});
		await ctrl.createPage({
			title: "Draft Nav",
			slug: "draft-nav",
			content: "Draft.",
			status: "draft",
			showInNavigation: true,
		});

		const result = await simulateGetNavigation(data);

		expect(result.pages).toHaveLength(1);
		expect(result.pages[0].title).toBe("About");
	});

	it("returns multiple navigation pages", async () => {
		const ctrl = createPagesController(data);
		await ctrl.createPage({
			title: "About",
			slug: "about",
			content: "About page.",
			status: "published",
			showInNavigation: true,
			position: 1,
		});
		await ctrl.createPage({
			title: "FAQ",
			slug: "faq",
			content: "FAQ page.",
			status: "published",
			showInNavigation: true,
			position: 2,
		});
		await ctrl.createPage({
			title: "Contact",
			slug: "contact",
			content: "Contact page.",
			status: "published",
			showInNavigation: true,
			position: 3,
		});

		const result = await simulateGetNavigation(data);

		expect(result.pages).toHaveLength(3);
		const titles = result.pages.map((p: { title: string }) => p.title);
		expect(titles).toContain("About");
		expect(titles).toContain("FAQ");
		expect(titles).toContain("Contact");
	});

	it("returns empty when no nav pages exist", async () => {
		const result = await simulateGetNavigation(data);

		expect(result.pages).toHaveLength(0);
	});
});

describe("store endpoint: get page by slug — published only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns a published page", async () => {
		const ctrl = createPagesController(data);
		await ctrl.createPage({
			title: "Terms of Service",
			slug: "terms",
			content: "Terms and conditions apply.",
			status: "published",
		});

		const result = await simulateGetPageBySlug(data, "terms");

		expect("page" in result).toBe(true);
		if ("page" in result) {
			expect(result.page.title).toBe("Terms of Service");
			expect(result.page.content).toBe("Terms and conditions apply.");
		}
	});

	it("returns 404 for draft page", async () => {
		const ctrl = createPagesController(data);
		await ctrl.createPage({
			title: "Draft",
			slug: "draft-page",
			content: "Not ready.",
			status: "draft",
		});

		const result = await simulateGetPageBySlug(data, "draft-page");

		expect(result).toEqual({ error: "Page not found", status: 404 });
	});

	it("returns 404 for nonexistent slug", async () => {
		const result = await simulateGetPageBySlug(data, "no-such-page");

		expect(result).toEqual({ error: "Page not found", status: 404 });
	});
});
