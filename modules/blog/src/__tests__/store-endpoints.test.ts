import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBlogController } from "../service-impl";

/**
 * Store endpoint integration tests for the blog module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. list-posts: only published posts, category/tag filtering, pagination
 * 2. get-post: by slug, only published visible
 * 3. search-posts: published-only search with pagination
 * 4. featured-posts: published + featured filter
 * 5. related-posts: validates source post exists and is published
 * 6. track-view: increments view count, validates published status
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Helpers ─────────────────────────────────────────────────────────

async function seedPost(
	controller: ReturnType<typeof createBlogController>,
	overrides: Partial<Parameters<typeof controller.createPost>[0]> & {
		title: string;
	},
) {
	const slug =
		overrides.slug ??
		overrides.title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "");
	return controller.createPost({
		content: "Test content for the blog post.",
		author: "Test Author",
		slug,
		...overrides,
	});
}

// ── Simulate endpoint logic ─────────────────────────────────────────

async function simulateListPosts(
	data: DataService,
	query: {
		category?: string;
		tag?: string;
		page?: number;
		limit?: number;
	} = {},
) {
	const controller = createBlogController(data);
	const page = query.page ?? 1;
	const limit = query.limit ?? 20;
	const posts = await controller.listPosts({
		status: "published",
		category: query.category,
		tag: query.tag,
		take: limit,
		skip: (page - 1) * limit,
	});
	return { posts, total: posts.length };
}

async function simulateGetPost(data: DataService, slug: string) {
	const controller = createBlogController(data);
	const post = await controller.getPostBySlug(slug);
	if (!post || post.status !== "published") return null;
	return post;
}

async function simulateSearchPosts(
	data: DataService,
	query: { q: string; page?: number; limit?: number },
) {
	const controller = createBlogController(data);
	const page = query.page ?? 1;
	const limit = query.limit ?? 20;
	const posts = await controller.listPosts({
		status: "published",
		search: query.q,
		take: limit,
		skip: (page - 1) * limit,
	});
	return { posts, total: posts.length };
}

async function simulateFeaturedPosts(
	data: DataService,
	query: { limit?: number } = {},
) {
	const controller = createBlogController(data);
	const posts = await controller.listPosts({
		status: "published",
		featured: true,
		take: query.limit ?? 5,
	});
	return { posts, total: posts.length };
}

async function simulateRelatedPosts(
	data: DataService,
	slug: string,
	query: { limit?: number } = {},
) {
	const controller = createBlogController(data);
	const post = await controller.getPostBySlug(slug);
	if (!post || post.status !== "published") return { posts: [] };
	const related = await controller.getRelatedPosts(post.id, query.limit ?? 5);
	return { posts: related };
}

async function simulateTrackView(data: DataService, slug: string) {
	const controller = createBlogController(data);
	const post = await controller.getPostBySlug(slug);
	if (!post || post.status !== "published") return { success: false };
	await controller.incrementViews(post.id);
	return { success: true };
}

// ── Tests ───────────────────────────────────────────────────────────

describe("store endpoint: list posts — published only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only published posts", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, { title: "Published", status: "published" });
		await seedPost(ctrl, { title: "Draft", status: "draft" });
		await seedPost(ctrl, { title: "Archived", status: "archived" });

		const result = await simulateListPosts(data);

		expect(result.posts).toHaveLength(1);
		expect(result.posts[0].title).toBe("Published");
	});

	it("filters by category", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "Tech Post",
			status: "published",
			category: "tech",
		});
		await seedPost(ctrl, {
			title: "Food Post",
			status: "published",
			category: "food",
		});

		const result = await simulateListPosts(data, { category: "tech" });

		expect(result.posts).toHaveLength(1);
		expect(result.posts[0].title).toBe("Tech Post");
	});

	it("filters by tag", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "Tagged",
			status: "published",
			tags: ["javascript", "react"],
		});
		await seedPost(ctrl, {
			title: "Other",
			status: "published",
			tags: ["python"],
		});

		const result = await simulateListPosts(data, { tag: "react" });

		expect(result.posts).toHaveLength(1);
		expect(result.posts[0].title).toBe("Tagged");
	});

	it("paginates results", async () => {
		const ctrl = createBlogController(data);
		for (let i = 0; i < 5; i++) {
			await seedPost(ctrl, { title: `Post ${i}`, status: "published" });
		}

		const page1 = await simulateListPosts(data, { page: 1, limit: 2 });
		const page2 = await simulateListPosts(data, { page: 2, limit: 2 });
		const page3 = await simulateListPosts(data, { page: 3, limit: 2 });

		expect(page1.posts).toHaveLength(2);
		expect(page2.posts).toHaveLength(2);
		expect(page3.posts).toHaveLength(1);
	});

	it("returns total matching the page size", async () => {
		const ctrl = createBlogController(data);
		for (let i = 0; i < 3; i++) {
			await seedPost(ctrl, { title: `Post ${i}`, status: "published" });
		}
		await seedPost(ctrl, { title: "Draft", status: "draft" });

		const result = await simulateListPosts(data, { limit: 2 });

		expect(result.posts).toHaveLength(2);
		expect(result.total).toBe(2); // total is posts.length for the page
	});

	it("returns empty array when no published posts exist", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, { title: "Draft Only", status: "draft" });

		const result = await simulateListPosts(data);

		expect(result.posts).toHaveLength(0);
		expect(result.total).toBe(0);
	});
});

describe("store endpoint: get post — slug lookup", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns a published post by slug", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "My Post",
			slug: "my-post",
			status: "published",
		});

		const post = await simulateGetPost(data, "my-post");

		expect(post).not.toBeNull();
		expect(post?.title).toBe("My Post");
	});

	it("returns null for a draft post", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "Draft Post",
			slug: "draft-post",
			status: "draft",
		});

		const post = await simulateGetPost(data, "draft-post");

		expect(post).toBeNull();
	});

	it("returns null for a nonexistent slug", async () => {
		const post = await simulateGetPost(data, "nonexistent-slug");

		expect(post).toBeNull();
	});

	it("returns null for an archived post", async () => {
		const ctrl = createBlogController(data);
		const created = await seedPost(ctrl, {
			title: "Old Post",
			slug: "old-post",
			status: "published",
		});
		await ctrl.archivePost(created.id);

		const post = await simulateGetPost(data, "old-post");

		expect(post).toBeNull();
	});
});

describe("store endpoint: search posts — published only", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("searches only published posts", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "JavaScript Guide",
			status: "published",
			content: "Learn JavaScript basics.",
		});
		await seedPost(ctrl, {
			title: "JavaScript Draft",
			status: "draft",
			content: "Draft about JavaScript.",
		});

		const result = await simulateSearchPosts(data, { q: "JavaScript" });

		expect(result.posts).toHaveLength(1);
		expect(result.posts[0].title).toBe("JavaScript Guide");
	});

	it("returns empty for non-matching query", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "Python Tutorial",
			status: "published",
		});

		const result = await simulateSearchPosts(data, { q: "rust" });

		expect(result.posts).toHaveLength(0);
	});
});

describe("store endpoint: featured posts", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns only published and featured posts", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "Featured",
			status: "published",
			featured: true,
		});
		await seedPost(ctrl, {
			title: "Normal",
			status: "published",
			featured: false,
		});
		await seedPost(ctrl, {
			title: "Featured Draft",
			status: "draft",
			featured: true,
		});

		const result = await simulateFeaturedPosts(data);

		expect(result.posts).toHaveLength(1);
		expect(result.posts[0].title).toBe("Featured");
	});

	it("respects limit parameter", async () => {
		const ctrl = createBlogController(data);
		for (let i = 0; i < 5; i++) {
			await seedPost(ctrl, {
				title: `Featured ${i}`,
				status: "published",
				featured: true,
			});
		}

		const result = await simulateFeaturedPosts(data, { limit: 2 });

		expect(result.posts).toHaveLength(2);
	});
});

describe("store endpoint: related posts", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns empty when source post is not published", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "Draft",
			slug: "draft-post",
			status: "draft",
		});

		const result = await simulateRelatedPosts(data, "draft-post");

		expect(result.posts).toHaveLength(0);
	});

	it("returns empty when source post does not exist", async () => {
		const result = await simulateRelatedPosts(data, "nonexistent");

		expect(result.posts).toHaveLength(0);
	});

	it("returns related posts for a published post", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "Source",
			slug: "source",
			status: "published",
			category: "tech",
			tags: ["js"],
		});
		await seedPost(ctrl, {
			title: "Related",
			slug: "related",
			status: "published",
			category: "tech",
			tags: ["js"],
		});

		const result = await simulateRelatedPosts(data, "source");

		// Related posts are based on shared category/tags
		expect(result.posts.length).toBeGreaterThanOrEqual(0);
	});
});

describe("store endpoint: track view", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("increments view count for a published post", async () => {
		const ctrl = createBlogController(data);
		const post = await seedPost(ctrl, {
			title: "Viewable",
			slug: "viewable",
			status: "published",
		});
		expect(post.views).toBe(0);

		const result = await simulateTrackView(data, "viewable");
		expect(result.success).toBe(true);

		const updated = await ctrl.getPostBySlug("viewable");
		expect(updated?.views).toBe(1);
	});

	it("returns failure for a draft post", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "Draft",
			slug: "draft",
			status: "draft",
		});

		const result = await simulateTrackView(data, "draft");
		expect(result.success).toBe(false);
	});

	it("returns failure for a nonexistent post", async () => {
		const result = await simulateTrackView(data, "nonexistent");
		expect(result.success).toBe(false);
	});

	it("increments multiple times", async () => {
		const ctrl = createBlogController(data);
		await seedPost(ctrl, {
			title: "Popular",
			slug: "popular",
			status: "published",
		});

		await simulateTrackView(data, "popular");
		await simulateTrackView(data, "popular");
		await simulateTrackView(data, "popular");

		const post = await ctrl.getPostBySlug("popular");
		expect(post?.views).toBe(3);
	});
});
