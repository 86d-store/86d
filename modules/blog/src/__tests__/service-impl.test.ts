import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBlogController } from "../service-impl";

describe("createBlogController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBlogController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBlogController(mockData);
	});

	// ── createPost ─────────────────────────────────────────────────────────────

	describe("createPost", () => {
		it("creates a draft post with minimal fields", async () => {
			const post = await controller.createPost({
				title: "Hello World",
				slug: "hello-world",
				content: "This is my first post.",
			});

			expect(post.id).toBeDefined();
			expect(post.title).toBe("Hello World");
			expect(post.slug).toBe("hello-world");
			expect(post.content).toBe("This is my first post.");
			expect(post.status).toBe("draft");
			expect(post.tags).toEqual([]);
			expect(post.featured).toBe(false);
			expect(post.readingTime).toBeGreaterThanOrEqual(1);
			expect(post.views).toBe(0);
			expect(post.publishedAt).toBeUndefined();
			expect(post.scheduledAt).toBeUndefined();
			expect(post.createdAt).toBeInstanceOf(Date);
			expect(post.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a published post with publishedAt set", async () => {
			const post = await controller.createPost({
				title: "Published Post",
				slug: "published-post",
				content: "Content here.",
				status: "published",
			});

			expect(post.status).toBe("published");
			expect(post.publishedAt).toBeInstanceOf(Date);
		});

		it("creates a post with all optional fields", async () => {
			const post = await controller.createPost({
				title: "Full Post",
				slug: "full-post",
				content: "Full content here.",
				excerpt: "A brief summary.",
				coverImage: "https://example.com/cover.jpg",
				author: "Jane Doe",
				tags: ["news", "updates"],
				category: "Announcements",
				featured: true,
				metaTitle: "Full Post | My Blog",
				metaDescription: "Read about our latest updates.",
			});

			expect(post.excerpt).toBe("A brief summary.");
			expect(post.coverImage).toBe("https://example.com/cover.jpg");
			expect(post.author).toBe("Jane Doe");
			expect(post.tags).toEqual(["news", "updates"]);
			expect(post.category).toBe("Announcements");
			expect(post.featured).toBe(true);
			expect(post.metaTitle).toBe("Full Post | My Blog");
			expect(post.metaDescription).toBe("Read about our latest updates.");
		});

		it("auto-generates slug from title when slug is empty", async () => {
			const post = await controller.createPost({
				title: "My Amazing Blog Post!",
				slug: "",
				content: "Content.",
			});

			expect(post.slug).toBe("my-amazing-blog-post");
		});

		it("stores the post in the data service", async () => {
			await controller.createPost({
				title: "Stored Post",
				slug: "stored-post",
				content: "Stored content.",
			});

			expect(mockData.size("post")).toBe(1);
		});

		it("creates a scheduled post with scheduledAt", async () => {
			const futureDate = new Date(Date.now() + 86400000);
			const post = await controller.createPost({
				title: "Scheduled Post",
				slug: "scheduled-post",
				content: "Coming soon.",
				status: "scheduled",
				scheduledAt: futureDate,
			});

			expect(post.status).toBe("scheduled");
			expect(post.scheduledAt).toEqual(futureDate);
			expect(post.publishedAt).toBeUndefined();
		});

		it("falls back to draft when scheduled without scheduledAt", async () => {
			const post = await controller.createPost({
				title: "No Date",
				slug: "no-date",
				content: "Content.",
				status: "scheduled",
			});

			expect(post.status).toBe("draft");
			expect(post.scheduledAt).toBeUndefined();
		});

		it("calculates reading time from content", async () => {
			const words = Array(400).fill("word").join(" ");
			const post = await controller.createPost({
				title: "Long Post",
				slug: "long-post",
				content: words,
			});

			expect(post.readingTime).toBe(2);
		});

		it("calculates reading time minimum of 1 minute", async () => {
			const post = await controller.createPost({
				title: "Short",
				slug: "short",
				content: "Just a few words.",
			});

			expect(post.readingTime).toBe(1);
		});
	});

	// ── getPost ────────────────────────────────────────────────────────────────

	describe("getPost", () => {
		it("returns a post by id", async () => {
			const created = await controller.createPost({
				title: "Test Post",
				slug: "test-post",
				content: "Content.",
			});

			const found = await controller.getPost(created.id);
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Test Post");
		});

		it("returns null for non-existent id", async () => {
			const found = await controller.getPost("non-existent");
			expect(found).toBeNull();
		});
	});

	// ── getPostBySlug ──────────────────────────────────────────────────────────

	describe("getPostBySlug", () => {
		it("returns a post by slug", async () => {
			await controller.createPost({
				title: "Slug Test",
				slug: "slug-test",
				content: "Content.",
			});

			const found = await controller.getPostBySlug("slug-test");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Slug Test");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getPostBySlug("no-such-slug");
			expect(found).toBeNull();
		});
	});

	// ── updatePost ─────────────────────────────────────────────────────────────

	describe("updatePost", () => {
		it("updates the title", async () => {
			const created = await controller.createPost({
				title: "Original",
				slug: "original",
				content: "Content.",
			});

			const updated = await controller.updatePost(created.id, {
				title: "Updated Title",
			});

			expect(updated).not.toBeNull();
			expect(updated?.title).toBe("Updated Title");
			expect(updated?.slug).toBe("original");
		});

		it("updates content and recalculates reading time", async () => {
			const created = await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Old content.",
			});

			const longContent = Array(600).fill("word").join(" ");
			const updated = await controller.updatePost(created.id, {
				content: longContent,
			});

			expect(updated?.content).toBe(longContent);
			expect(updated?.readingTime).toBe(3);
		});

		it("updates tags", async () => {
			const created = await controller.createPost({
				title: "Tagged",
				slug: "tagged",
				content: "Content.",
				tags: ["old"],
			});

			const updated = await controller.updatePost(created.id, {
				tags: ["new", "tags"],
			});

			expect(updated?.tags).toEqual(["new", "tags"]);
		});

		it("sets publishedAt when transitioning to published", async () => {
			const created = await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});

			expect(created.publishedAt).toBeUndefined();

			const updated = await controller.updatePost(created.id, {
				status: "published",
			});

			expect(updated?.status).toBe("published");
			expect(updated?.publishedAt).toBeInstanceOf(Date);
		});

		it("preserves publishedAt when already published", async () => {
			const created = await controller.createPost({
				title: "Published",
				slug: "published",
				content: "Content.",
				status: "published",
			});

			const originalPublishedAt = created.publishedAt;

			const updated = await controller.updatePost(created.id, {
				title: "Updated Published",
			});

			expect(updated?.publishedAt).toEqual(originalPublishedAt);
		});

		it("returns null for non-existent post", async () => {
			const updated = await controller.updatePost("non-existent", {
				title: "Nope",
			});

			expect(updated).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
			});

			const updated = await controller.updatePost(created.id, {
				title: "New Title",
			});

			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("updates featured flag", async () => {
			const created = await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
			});

			expect(created.featured).toBe(false);

			const updated = await controller.updatePost(created.id, {
				featured: true,
			});

			expect(updated?.featured).toBe(true);
		});

		it("updates meta fields", async () => {
			const created = await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
			});

			const updated = await controller.updatePost(created.id, {
				metaTitle: "SEO Title",
				metaDescription: "SEO Description",
			});

			expect(updated?.metaTitle).toBe("SEO Title");
			expect(updated?.metaDescription).toBe("SEO Description");
		});

		it("reverts to current status when scheduling without scheduledAt", async () => {
			const created = await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});

			const updated = await controller.updatePost(created.id, {
				status: "scheduled",
			});

			expect(updated?.status).toBe("draft");
		});
	});

	// ── deletePost ─────────────────────────────────────────────────────────────

	describe("deletePost", () => {
		it("deletes an existing post", async () => {
			const created = await controller.createPost({
				title: "To Delete",
				slug: "to-delete",
				content: "Content.",
			});

			const deleted = await controller.deletePost(created.id);
			expect(deleted).toBe(true);
			expect(mockData.size("post")).toBe(0);
		});

		it("returns false for non-existent post", async () => {
			const deleted = await controller.deletePost("non-existent");
			expect(deleted).toBe(false);
		});
	});

	// ── publishPost ────────────────────────────────────────────────────────────

	describe("publishPost", () => {
		it("publishes a draft post", async () => {
			const created = await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});

			const published = await controller.publishPost(created.id);
			expect(published?.status).toBe("published");
			expect(published?.publishedAt).toBeInstanceOf(Date);
		});

		it("preserves existing publishedAt on re-publish", async () => {
			const created = await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
				status: "published",
			});

			const originalDate = created.publishedAt;

			// Unpublish then re-publish
			await controller.unpublishPost(created.id);
			const republished = await controller.publishPost(created.id);

			expect(republished?.publishedAt).toEqual(originalDate);
		});

		it("returns null for non-existent post", async () => {
			const result = await controller.publishPost("non-existent");
			expect(result).toBeNull();
		});

		it("clears scheduledAt when publishing a scheduled post", async () => {
			const futureDate = new Date(Date.now() + 86400000);
			const created = await controller.createPost({
				title: "Scheduled",
				slug: "scheduled",
				content: "Content.",
				status: "scheduled",
				scheduledAt: futureDate,
			});

			const published = await controller.publishPost(created.id);
			expect(published?.status).toBe("published");
			expect(published?.scheduledAt).toBeUndefined();
		});
	});

	// ── unpublishPost ──────────────────────────────────────────────────────────

	describe("unpublishPost", () => {
		it("unpublishes a published post", async () => {
			const created = await controller.createPost({
				title: "Published",
				slug: "published",
				content: "Content.",
				status: "published",
			});

			const unpublished = await controller.unpublishPost(created.id);
			expect(unpublished?.status).toBe("draft");
		});

		it("returns null for non-existent post", async () => {
			const result = await controller.unpublishPost("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── archivePost ────────────────────────────────────────────────────────────

	describe("archivePost", () => {
		it("archives a post", async () => {
			const created = await controller.createPost({
				title: "To Archive",
				slug: "to-archive",
				content: "Content.",
				status: "published",
			});

			const archived = await controller.archivePost(created.id);
			expect(archived?.status).toBe("archived");
		});

		it("returns null for non-existent post", async () => {
			const result = await controller.archivePost("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── duplicatePost ──────────────────────────────────────────────────────────

	describe("duplicatePost", () => {
		it("creates a copy of an existing post as draft", async () => {
			const original = await controller.createPost({
				title: "Original Post",
				slug: "original-post",
				content: "Original content.",
				tags: ["tag1", "tag2"],
				category: "News",
				status: "published",
				featured: true,
			});

			const duplicate = await controller.duplicatePost(original.id);

			expect(duplicate).not.toBeNull();
			expect(duplicate?.id).not.toBe(original.id);
			expect(duplicate?.title).toBe("Original Post (Copy)");
			expect(duplicate?.slug).toContain("original-post-copy-");
			expect(duplicate?.content).toBe("Original content.");
			expect(duplicate?.tags).toEqual(["tag1", "tag2"]);
			expect(duplicate?.category).toBe("News");
			expect(duplicate?.status).toBe("draft");
			expect(duplicate?.featured).toBe(false);
			expect(duplicate?.publishedAt).toBeUndefined();
			expect(duplicate?.views).toBe(0);
		});

		it("returns null for non-existent post", async () => {
			const result = await controller.duplicatePost("non-existent");
			expect(result).toBeNull();
		});

		it("creates independent copy (modifying original does not affect duplicate)", async () => {
			const original = await controller.createPost({
				title: "Source",
				slug: "source",
				content: "Content.",
			});

			const dup = await controller.duplicatePost(original.id);
			expect(dup).not.toBeNull();
			await controller.updatePost(original.id, { title: "Modified Source" });

			const fetchedDup = await controller.getPost(dup?.id ?? "");
			expect(fetchedDup?.title).toBe("Source (Copy)");
		});
	});

	// ── incrementViews ─────────────────────────────────────────────────────────

	describe("incrementViews", () => {
		it("increments view count by 1", async () => {
			const post = await controller.createPost({
				title: "Popular",
				slug: "popular",
				content: "Content.",
			});

			expect(post.views).toBe(0);

			const viewed = await controller.incrementViews(post.id);
			expect(viewed?.views).toBe(1);

			const viewed2 = await controller.incrementViews(post.id);
			expect(viewed2?.views).toBe(2);
		});

		it("returns null for non-existent post", async () => {
			const result = await controller.incrementViews("non-existent");
			expect(result).toBeNull();
		});
	});

	// ── listPosts ──────────────────────────────────────────────────────────────

	describe("listPosts", () => {
		it("returns all posts when no filters", async () => {
			await controller.createPost({
				title: "Post 1",
				slug: "post-1",
				content: "Content 1.",
			});
			await controller.createPost({
				title: "Post 2",
				slug: "post-2",
				content: "Content 2.",
			});

			const posts = await controller.listPosts();
			expect(posts).toHaveLength(2);
		});

		it("filters by status", async () => {
			await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});
			await controller.createPost({
				title: "Published",
				slug: "published",
				content: "Content.",
				status: "published",
			});

			const drafts = await controller.listPosts({ status: "draft" });
			expect(drafts).toHaveLength(1);
			expect(drafts[0]?.title).toBe("Draft");

			const published = await controller.listPosts({ status: "published" });
			expect(published).toHaveLength(1);
			expect(published[0]?.title).toBe("Published");
		});

		it("filters by category", async () => {
			await controller.createPost({
				title: "News Post",
				slug: "news-post",
				content: "Content.",
				category: "News",
			});
			await controller.createPost({
				title: "Guide Post",
				slug: "guide-post",
				content: "Content.",
				category: "Guides",
			});

			const news = await controller.listPosts({ category: "News" });
			expect(news).toHaveLength(1);
			expect(news[0]?.title).toBe("News Post");
		});

		it("filters by tag", async () => {
			await controller.createPost({
				title: "Tagged",
				slug: "tagged",
				content: "Content.",
				tags: ["featured", "news"],
			});
			await controller.createPost({
				title: "Not Tagged",
				slug: "not-tagged",
				content: "Content.",
				tags: ["other"],
			});

			const featured = await controller.listPosts({ tag: "featured" });
			expect(featured).toHaveLength(1);
			expect(featured[0]?.title).toBe("Tagged");
		});

		it("filters by featured", async () => {
			await controller.createPost({
				title: "Featured",
				slug: "featured",
				content: "Content.",
				featured: true,
			});
			await controller.createPost({
				title: "Normal",
				slug: "normal",
				content: "Content.",
			});

			const featured = await controller.listPosts({ featured: true });
			expect(featured).toHaveLength(1);
			expect(featured[0]?.title).toBe("Featured");
		});

		it("filters by search term in title", async () => {
			await controller.createPost({
				title: "React Hooks Guide",
				slug: "react-hooks",
				content: "Learn about hooks.",
			});
			await controller.createPost({
				title: "Vue Composition API",
				slug: "vue-composition",
				content: "Learn about Vue.",
			});

			const results = await controller.listPosts({ search: "react" });
			expect(results).toHaveLength(1);
			expect(results[0]?.title).toBe("React Hooks Guide");
		});

		it("filters by search term in content", async () => {
			await controller.createPost({
				title: "Post A",
				slug: "post-a",
				content: "This post discusses TypeScript generics.",
			});
			await controller.createPost({
				title: "Post B",
				slug: "post-b",
				content: "This post is about Python.",
			});

			const results = await controller.listPosts({ search: "typescript" });
			expect(results).toHaveLength(1);
			expect(results[0]?.title).toBe("Post A");
		});

		it("filters by search term in excerpt", async () => {
			await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
				excerpt: "A deep dive into Kubernetes.",
			});

			const results = await controller.listPosts({ search: "kubernetes" });
			expect(results).toHaveLength(1);
		});

		it("search is case-insensitive", async () => {
			await controller.createPost({
				title: "GraphQL Best Practices",
				slug: "graphql",
				content: "Content.",
			});

			const results = await controller.listPosts({ search: "GRAPHQL" });
			expect(results).toHaveLength(1);
		});

		it("respects take parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}.`,
				});
			}

			const posts = await controller.listPosts({ take: 3 });
			expect(posts).toHaveLength(3);
		});

		it("respects skip parameter", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}.`,
				});
			}

			const posts = await controller.listPosts({ skip: 3 });
			expect(posts).toHaveLength(2);
		});

		it("combines status and category filters", async () => {
			await controller.createPost({
				title: "Draft News",
				slug: "draft-news",
				content: "Content.",
				category: "News",
			});
			await controller.createPost({
				title: "Published News",
				slug: "published-news",
				content: "Content.",
				category: "News",
				status: "published",
			});
			await controller.createPost({
				title: "Published Guide",
				slug: "published-guide",
				content: "Content.",
				category: "Guides",
				status: "published",
			});

			const publishedNews = await controller.listPosts({
				status: "published",
				category: "News",
			});
			expect(publishedNews).toHaveLength(1);
			expect(publishedNews[0]?.title).toBe("Published News");
		});

		it("returns empty array when no matches", async () => {
			const posts = await controller.listPosts({ status: "published" });
			expect(posts).toEqual([]);
		});
	});

	// ── getRelatedPosts ────────────────────────────────────────────────────────

	describe("getRelatedPosts", () => {
		it("returns posts with shared tags scored higher", async () => {
			const target = await controller.createPost({
				title: "Target",
				slug: "target",
				content: "Content.",
				tags: ["react", "typescript", "hooks"],
				category: "Frontend",
				status: "published",
			});

			await controller.createPost({
				title: "Highly Related",
				slug: "highly-related",
				content: "Content.",
				tags: ["react", "typescript"],
				category: "Frontend",
				status: "published",
			});

			await controller.createPost({
				title: "Somewhat Related",
				slug: "somewhat-related",
				content: "Content.",
				tags: ["react"],
				category: "Backend",
				status: "published",
			});

			await controller.createPost({
				title: "Same Category Only",
				slug: "same-category",
				content: "Content.",
				tags: [],
				category: "Frontend",
				status: "published",
			});

			await controller.createPost({
				title: "Unrelated",
				slug: "unrelated",
				content: "Content.",
				tags: ["python"],
				category: "Backend",
				status: "published",
			});

			const related = await controller.getRelatedPosts(target.id);
			expect(related.length).toBeGreaterThanOrEqual(3);
			expect(related[0]?.title).toBe("Highly Related");
		});

		it("excludes the source post from results", async () => {
			const target = await controller.createPost({
				title: "Target",
				slug: "target",
				content: "Content.",
				tags: ["react"],
				status: "published",
			});

			const related = await controller.getRelatedPosts(target.id);
			expect(related.find((p) => p.id === target.id)).toBeUndefined();
		});

		it("only includes published posts", async () => {
			const target = await controller.createPost({
				title: "Target",
				slug: "target",
				content: "Content.",
				tags: ["react"],
				status: "published",
			});

			await controller.createPost({
				title: "Draft Related",
				slug: "draft-related",
				content: "Content.",
				tags: ["react"],
				status: "draft",
			});

			const related = await controller.getRelatedPosts(target.id);
			expect(related).toHaveLength(0);
		});

		it("returns empty array for non-existent post", async () => {
			const related = await controller.getRelatedPosts("non-existent");
			expect(related).toEqual([]);
		});

		it("respects limit parameter", async () => {
			const target = await controller.createPost({
				title: "Target",
				slug: "target",
				content: "Content.",
				tags: ["react"],
				status: "published",
			});

			for (let i = 0; i < 10; i++) {
				await controller.createPost({
					title: `Related ${i}`,
					slug: `related-${i}`,
					content: "Content.",
					tags: ["react"],
					status: "published",
				});
			}

			const related = await controller.getRelatedPosts(target.id, 3);
			expect(related).toHaveLength(3);
		});

		it("returns empty for post with no matching tags or category", async () => {
			const target = await controller.createPost({
				title: "Isolated",
				slug: "isolated",
				content: "Content.",
				tags: ["unique-tag"],
				category: "UniqueCategory",
				status: "published",
			});

			await controller.createPost({
				title: "Other",
				slug: "other",
				content: "Content.",
				tags: ["different"],
				category: "Different",
				status: "published",
			});

			const related = await controller.getRelatedPosts(target.id);
			expect(related).toHaveLength(0);
		});
	});

	// ── getStats ───────────────────────────────────────────────────────────────

	describe("getStats", () => {
		it("returns correct counts by status", async () => {
			await controller.createPost({
				title: "Draft 1",
				slug: "draft-1",
				content: "Content.",
			});
			await controller.createPost({
				title: "Draft 2",
				slug: "draft-2",
				content: "Content.",
			});
			await controller.createPost({
				title: "Published",
				slug: "published",
				content: "Content.",
				status: "published",
			});
			const scheduled = new Date(Date.now() + 86400000);
			await controller.createPost({
				title: "Scheduled",
				slug: "scheduled",
				content: "Content.",
				status: "scheduled",
				scheduledAt: scheduled,
			});

			const stats = await controller.getStats();
			expect(stats.total).toBe(4);
			expect(stats.draft).toBe(2);
			expect(stats.published).toBe(1);
			expect(stats.scheduled).toBe(1);
			expect(stats.archived).toBe(0);
		});

		it("counts views across all posts", async () => {
			const p1 = await controller.createPost({
				title: "P1",
				slug: "p1",
				content: "Content.",
			});
			const p2 = await controller.createPost({
				title: "P2",
				slug: "p2",
				content: "Content.",
			});

			await controller.incrementViews(p1.id);
			await controller.incrementViews(p1.id);
			await controller.incrementViews(p2.id);

			const stats = await controller.getStats();
			expect(stats.totalViews).toBe(3);
		});

		it("aggregates categories and tags", async () => {
			await controller.createPost({
				title: "P1",
				slug: "p1",
				content: "Content.",
				category: "Tech",
				tags: ["react", "typescript"],
			});
			await controller.createPost({
				title: "P2",
				slug: "p2",
				content: "Content.",
				category: "Tech",
				tags: ["react"],
			});
			await controller.createPost({
				title: "P3",
				slug: "p3",
				content: "Content.",
				category: "News",
				tags: ["announcements"],
			});

			const stats = await controller.getStats();
			expect(stats.categories).toEqual([
				{ category: "Tech", count: 2 },
				{ category: "News", count: 1 },
			]);
			expect(stats.tags[0]).toEqual({ tag: "react", count: 2 });
		});

		it("returns zeros for empty blog", async () => {
			const stats = await controller.getStats();
			expect(stats.total).toBe(0);
			expect(stats.draft).toBe(0);
			expect(stats.published).toBe(0);
			expect(stats.totalViews).toBe(0);
			expect(stats.categories).toEqual([]);
			expect(stats.tags).toEqual([]);
		});
	});

	// ── checkScheduledPosts ────────────────────────────────────────────────────

	describe("checkScheduledPosts", () => {
		it("publishes posts whose scheduledAt is in the past", async () => {
			const pastDate = new Date(Date.now() - 3600000);
			await controller.createPost({
				title: "Past Scheduled",
				slug: "past-scheduled",
				content: "Content.",
				status: "scheduled",
				scheduledAt: pastDate,
			});

			const published = await controller.checkScheduledPosts();
			expect(published).toHaveLength(1);
			expect(published[0]?.status).toBe("published");
			expect(published[0]?.publishedAt).toEqual(pastDate);
			expect(published[0]?.scheduledAt).toBeUndefined();
		});

		it("does not publish posts scheduled for the future", async () => {
			const futureDate = new Date(Date.now() + 86400000);
			await controller.createPost({
				title: "Future Scheduled",
				slug: "future-scheduled",
				content: "Content.",
				status: "scheduled",
				scheduledAt: futureDate,
			});

			const published = await controller.checkScheduledPosts();
			expect(published).toHaveLength(0);
		});

		it("handles multiple scheduled posts at once", async () => {
			const pastDate1 = new Date(Date.now() - 7200000);
			const pastDate2 = new Date(Date.now() - 3600000);
			const futureDate = new Date(Date.now() + 86400000);

			await controller.createPost({
				title: "Past 1",
				slug: "past-1",
				content: "Content.",
				status: "scheduled",
				scheduledAt: pastDate1,
			});
			await controller.createPost({
				title: "Past 2",
				slug: "past-2",
				content: "Content.",
				status: "scheduled",
				scheduledAt: pastDate2,
			});
			await controller.createPost({
				title: "Future",
				slug: "future",
				content: "Content.",
				status: "scheduled",
				scheduledAt: futureDate,
			});

			const published = await controller.checkScheduledPosts();
			expect(published).toHaveLength(2);
		});

		it("returns empty array when no scheduled posts exist", async () => {
			await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});

			const published = await controller.checkScheduledPosts();
			expect(published).toEqual([]);
		});
	});

	// ── bulkUpdateStatus ───────────────────────────────────────────────────────

	describe("bulkUpdateStatus", () => {
		it("updates status for multiple posts", async () => {
			const p1 = await controller.createPost({
				title: "P1",
				slug: "p1",
				content: "Content.",
			});
			const p2 = await controller.createPost({
				title: "P2",
				slug: "p2",
				content: "Content.",
			});

			const result = await controller.bulkUpdateStatus(
				[p1.id, p2.id],
				"published",
			);

			expect(result.updated).toBe(2);
			expect(result.failed).toEqual([]);

			const fetched1 = await controller.getPost(p1.id);
			const fetched2 = await controller.getPost(p2.id);
			expect(fetched1?.status).toBe("published");
			expect(fetched2?.status).toBe("published");
		});

		it("reports failed ids for non-existent posts", async () => {
			const p1 = await controller.createPost({
				title: "P1",
				slug: "p1",
				content: "Content.",
			});

			const result = await controller.bulkUpdateStatus(
				[p1.id, "non-existent"],
				"published",
			);

			expect(result.updated).toBe(1);
			expect(result.failed).toEqual(["non-existent"]);
		});

		it("sets publishedAt when bulk publishing drafts", async () => {
			const p = await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});

			await controller.bulkUpdateStatus([p.id], "published");

			const fetched = await controller.getPost(p.id);
			expect(fetched?.publishedAt).toBeInstanceOf(Date);
		});
	});

	// ── bulkDelete ─────────────────────────────────────────────────────────────

	describe("bulkDelete", () => {
		it("deletes multiple posts", async () => {
			const p1 = await controller.createPost({
				title: "P1",
				slug: "p1",
				content: "Content.",
			});
			const p2 = await controller.createPost({
				title: "P2",
				slug: "p2",
				content: "Content.",
			});

			const result = await controller.bulkDelete([p1.id, p2.id]);

			expect(result.deleted).toBe(2);
			expect(result.failed).toEqual([]);
			expect(mockData.size("post")).toBe(0);
		});

		it("reports failed ids for non-existent posts", async () => {
			const p1 = await controller.createPost({
				title: "P1",
				slug: "p1",
				content: "Content.",
			});

			const result = await controller.bulkDelete([p1.id, "non-existent"]);

			expect(result.deleted).toBe(1);
			expect(result.failed).toEqual(["non-existent"]);
		});
	});

	// ── Lifecycle transitions ──────────────────────────────────────────────────

	describe("lifecycle transitions", () => {
		it("draft -> published -> archived", async () => {
			const post = await controller.createPost({
				title: "Lifecycle",
				slug: "lifecycle",
				content: "Content.",
			});

			expect(post.status).toBe("draft");

			const published = await controller.publishPost(post.id);
			expect(published?.status).toBe("published");

			const archived = await controller.archivePost(post.id);
			expect(archived?.status).toBe("archived");
		});

		it("draft -> published -> draft (unpublish)", async () => {
			const post = await controller.createPost({
				title: "Lifecycle 2",
				slug: "lifecycle-2",
				content: "Content.",
			});

			await controller.publishPost(post.id);
			const unpublished = await controller.unpublishPost(post.id);
			expect(unpublished?.status).toBe("draft");
		});

		it("draft -> scheduled -> published (via checkScheduledPosts)", async () => {
			const pastDate = new Date(Date.now() - 1000);
			const post = await controller.createPost({
				title: "Scheduled Lifecycle",
				slug: "scheduled-lifecycle",
				content: "Content.",
				status: "scheduled",
				scheduledAt: pastDate,
			});

			expect(post.status).toBe("scheduled");

			const published = await controller.checkScheduledPosts();
			expect(published).toHaveLength(1);
			expect(published[0]?.status).toBe("published");
		});
	});

	// ── Edge cases ─────────────────────────────────────────────────────────────

	describe("edge cases", () => {
		it("handles posts with no optional fields", async () => {
			const post = await controller.createPost({
				title: "Minimal",
				slug: "minimal",
				content: "Content.",
			});

			expect(post.excerpt).toBeUndefined();
			expect(post.coverImage).toBeUndefined();
			expect(post.author).toBeUndefined();
			expect(post.category).toBeUndefined();
			expect(post.metaTitle).toBeUndefined();
			expect(post.metaDescription).toBeUndefined();
		});

		it("handles updating multiple fields at once", async () => {
			const post = await controller.createPost({
				title: "Multi Update",
				slug: "multi-update",
				content: "Original content.",
			});

			const updated = await controller.updatePost(post.id, {
				title: "New Title",
				content: "New content.",
				excerpt: "New excerpt.",
				author: "New Author",
				tags: ["tag1"],
				category: "New Category",
				featured: true,
				metaTitle: "New Meta",
			});

			expect(updated?.title).toBe("New Title");
			expect(updated?.content).toBe("New content.");
			expect(updated?.excerpt).toBe("New excerpt.");
			expect(updated?.author).toBe("New Author");
			expect(updated?.tags).toEqual(["tag1"]);
			expect(updated?.category).toBe("New Category");
			expect(updated?.featured).toBe(true);
			expect(updated?.metaTitle).toBe("New Meta");
		});

		it("handles empty tags array", async () => {
			const post = await controller.createPost({
				title: "No Tags",
				slug: "no-tags",
				content: "Content.",
				tags: [],
			});

			expect(post.tags).toEqual([]);
		});

		it("handles concurrent creates", async () => {
			const [a, b, c] = await Promise.all([
				controller.createPost({
					title: "Post A",
					slug: "post-a",
					content: "A.",
				}),
				controller.createPost({
					title: "Post B",
					slug: "post-b",
					content: "B.",
				}),
				controller.createPost({
					title: "Post C",
					slug: "post-c",
					content: "C.",
				}),
			]);

			expect(a.id).not.toBe(b.id);
			expect(b.id).not.toBe(c.id);
			expect(mockData.size("post")).toBe(3);
		});
	});
});
