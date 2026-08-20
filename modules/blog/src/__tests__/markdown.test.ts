import {
	createMockDataService,
	createMockModuleContext,
} from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { toMarkdownBlogListing, toMarkdownBlogPost } from "../markdown";
import { createBlogController } from "../service-impl";

function makeCtx(controller: ReturnType<typeof createBlogController>) {
	return createMockModuleContext({
		data: createMockDataService(),
		controllers: { blog: controller },
	});
}

describe("toMarkdownBlogListing", () => {
	let controller: ReturnType<typeof createBlogController>;

	beforeEach(() => {
		const mockData = createMockDataService();
		controller = createBlogController(mockData);
	});

	it("returns listing with published posts", async () => {
		await controller.createPost({
			title: "First Post",
			slug: "first-post",
			content: "Content 1",
			excerpt: "Summary of first post",
			author: "Alice",
			status: "published",
		});
		await controller.createPost({
			title: "Second Post",
			slug: "second-post",
			content: "Content 2",
			status: "published",
		});
		// Draft post should not appear
		await controller.createPost({
			title: "Draft Post",
			slug: "draft-post",
			content: "Not ready",
			status: "draft",
		});

		const ctx = makeCtx(controller);
		const md = await toMarkdownBlogListing(ctx, {});

		expect(md).toContain("# Blog");
		expect(md).toContain("[First Post](/blog/first-post)");
		expect(md).toContain("[Second Post](/blog/second-post)");
		expect(md).toContain("Summary of first post");
		expect(md).toContain("By Alice");
		expect(md).not.toContain("Draft Post");
	});

	it("returns empty state when no published posts", async () => {
		await controller.createPost({
			title: "Draft Only",
			slug: "draft-only",
			content: "Hidden",
			status: "draft",
		});

		const ctx = makeCtx(controller);
		const md = await toMarkdownBlogListing(ctx, {});

		expect(md).toContain("# Blog");
		expect(md).toContain("No posts yet.");
	});

	it("returns null when controller is missing", async () => {
		const ctx = createMockModuleContext({ controllers: {} });
		const md = await toMarkdownBlogListing(ctx, {});
		expect(md).toBeNull();
	});
});

describe("toMarkdownBlogPost", () => {
	let controller: ReturnType<typeof createBlogController>;

	beforeEach(() => {
		const mockData = createMockDataService();
		controller = createBlogController(mockData);
	});

	it("renders a published post with all fields", async () => {
		await controller.createPost({
			title: "Deep Dive",
			slug: "deep-dive",
			content: "Full article content here.",
			excerpt: "A brief excerpt.",
			author: "Bob",
			status: "published",
		});

		const ctx = makeCtx(controller);
		const md = await toMarkdownBlogPost(ctx, { slug: "deep-dive" });

		expect(md).toContain("# Deep Dive");
		expect(md).toContain("By Bob");
		expect(md).toContain("A brief excerpt.");
		expect(md).toContain("Full article content here.");
		expect(md).toContain("[View post](/blog/deep-dive)");
	});

	it("returns null for draft post", async () => {
		await controller.createPost({
			title: "Draft",
			slug: "draft",
			content: "Not ready.",
			status: "draft",
		});

		const ctx = makeCtx(controller);
		const md = await toMarkdownBlogPost(ctx, { slug: "draft" });

		expect(md).toBeNull();
	});

	it("returns null for missing slug", async () => {
		const ctx = makeCtx(controller);
		const md = await toMarkdownBlogPost(ctx, {});
		expect(md).toBeNull();
	});

	it("returns null for non-existent slug", async () => {
		const ctx = makeCtx(controller);
		const md = await toMarkdownBlogPost(ctx, { slug: "nope" });
		expect(md).toBeNull();
	});
});
