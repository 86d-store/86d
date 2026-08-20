import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { toMarkdownPageDetail, toMarkdownPageListing } from "../markdown";
import { createPagesController } from "../service-impl";

function makeCtx(controller: ReturnType<typeof createPagesController>) {
	return createMockModuleContext({
		data: createMockDataService(),
		controllers: { pages: controller },
	});
}

describe("toMarkdownPageListing", () => {
	let controller: ReturnType<typeof createPagesController>;

	beforeEach(() => {
		const mockData = createMockDataService();
		controller = createPagesController(mockData);
	});

	it("renders published pages", async () => {
		await controller.createPage({
			title: "About Us",
			content: "About content.",
			status: "published",
			excerpt: "Learn about us.",
		});
		await controller.createPage({
			title: "Contact",
			content: "Contact content.",
			status: "published",
		});

		const ctx = makeCtx(controller);
		const md = await toMarkdownPageListing(ctx, {});
		expect(md).toContain("# Pages");
		expect(md).toContain("[About Us](/p/about-us)");
		expect(md).toContain("Learn about us.");
		expect(md).toContain("[Contact](/p/contact)");
	});

	it("shows empty message when no pages", async () => {
		const ctx = makeCtx(controller);
		const md = await toMarkdownPageListing(ctx, {});
		expect(md).toContain("No pages yet.");
	});

	it("excludes draft pages", async () => {
		await controller.createPage({
			title: "Draft Page",
			content: "Draft.",
		});

		const ctx = makeCtx(controller);
		const md = await toMarkdownPageListing(ctx, {});
		expect(md).not.toContain("Draft Page");
	});

	it("returns null when controller is missing", async () => {
		const ctx = createMockModuleContext({ controllers: {} });
		const md = await toMarkdownPageListing(ctx, {});
		expect(md).toBeNull();
	});
});

describe("toMarkdownPageDetail", () => {
	let controller: ReturnType<typeof createPagesController>;

	beforeEach(() => {
		const mockData = createMockDataService();
		controller = createPagesController(mockData);
	});

	it("renders a published page", async () => {
		await controller.createPage({
			title: "About Us",
			slug: "about",
			content: "We are a great company.",
			excerpt: "About our company.",
			status: "published",
		});

		const ctx = makeCtx(controller);
		const md = await toMarkdownPageDetail(ctx, { slug: "about" });
		expect(md).toContain("# About Us");
		expect(md).toContain("About our company.");
		expect(md).toContain("We are a great company.");
	});

	it("returns null for non-existent page", async () => {
		const ctx = makeCtx(controller);
		const md = await toMarkdownPageDetail(ctx, { slug: "non-existent" });
		expect(md).toBeNull();
	});

	it("returns null for draft page", async () => {
		await controller.createPage({
			title: "Draft",
			slug: "draft",
			content: "Not published.",
		});

		const ctx = makeCtx(controller);
		const md = await toMarkdownPageDetail(ctx, { slug: "draft" });
		expect(md).toBeNull();
	});

	it("returns null when no slug provided", async () => {
		const ctx = makeCtx(controller);
		const md = await toMarkdownPageDetail(ctx, {});
		expect(md).toBeNull();
	});
});
