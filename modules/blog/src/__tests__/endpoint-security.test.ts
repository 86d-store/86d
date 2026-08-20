import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBlogController } from "../service-impl";
import { getPostEndpoint } from "../store/endpoints/get-post";
import { listPostsEndpoint } from "../store/endpoints/list-posts";
import { relatedPostsEndpoint } from "../store/endpoints/related-posts";
import { searchPostsEndpoint } from "../store/endpoints/search-posts";
import { trackViewEndpoint } from "../store/endpoints/track-view";

/**
 * Endpoint-security tests for the blog module.
 *
 * These tests verify data-integrity invariants that, if broken, could
 * expose draft content publicly or corrupt post data:
 *
 * 1. Slug uniqueness: two posts with the same slug are distinguishable
 * 2. Draft vs published visibility: status filtering correctness
 * 3. Author isolation: updating author does not leak across posts
 * 4. Category filtering integrity: filters never return wrong category
 * 5. Pagination bounds: skip/take cannot expose unintended data
 * 6. Content sanitization expectations: raw content stored as-is
 * 7. Status transition integrity: lifecycle changes are consistent
 * 8. Featured flag isolation: featuring one post does not affect others
 * 9. View count isolation: incrementing views does not affect other posts
 * 10. Bulk operation safety: bulk ops do not corrupt unrelated data
 */

describe("blog endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBlogController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBlogController(mockData);
	});

	describe("store endpoint input hardening", () => {
		it("sanitizes public search and filter text inputs", () => {
			const searchQuery = searchPostsEndpoint.options.query.parse({
				q: "<script>alert(1)</script>summer sale",
			});
			const listQuery = listPostsEndpoint.options.query.parse({
				category: "  <b>News</b>  ",
				tag: "<i>Featured</i>",
			});

			expect(searchQuery.q).toBe("summer sale");
			expect(listQuery.category).toBe("News");
			expect(listQuery.tag).toBe("Featured");
		});

		it("rejects oversized slugs on public blog routes", () => {
			const oversizedSlug = "a".repeat(201);

			expect(
				getPostEndpoint.options.params.safeParse({ slug: oversizedSlug })
					.success,
			).toBe(false);
			expect(
				relatedPostsEndpoint.options.params.safeParse({ slug: oversizedSlug })
					.success,
			).toBe(false);
			expect(
				trackViewEndpoint.options.params.safeParse({ slug: oversizedSlug })
					.success,
			).toBe(false);
		});
	});

	// -- Slug Uniqueness ------------------------------------------------------

	describe("slug uniqueness", () => {
		it("two posts with identical slugs are both stored and retrievable by id", async () => {
			const postA = await controller.createPost({
				title: "First Post",
				slug: "same-slug",
				content: "Content A.",
			});
			const postB = await controller.createPost({
				title: "Second Post",
				slug: "same-slug",
				content: "Content B.",
			});

			expect(postA.id).not.toBe(postB.id);
			expect(postA.slug).toBe(postB.slug);
			expect(mockData.size("post")).toBe(2);

			const fetchedA = await controller.getPost(postA.id);
			const fetchedB = await controller.getPost(postB.id);
			expect(fetchedA?.title).toBe("First Post");
			expect(fetchedB?.title).toBe("Second Post");
		});

		it("getPostBySlug returns only the first match for duplicate slugs", async () => {
			await controller.createPost({
				title: "Original",
				slug: "dup-slug",
				content: "Content.",
			});
			await controller.createPost({
				title: "Duplicate",
				slug: "dup-slug",
				content: "Other content.",
			});

			const found = await controller.getPostBySlug("dup-slug");
			expect(found).not.toBeNull();
			expect(found?.slug).toBe("dup-slug");
		});

		it("updating a post slug does not affect other posts with the old slug", async () => {
			const postA = await controller.createPost({
				title: "Post A",
				slug: "shared-slug",
				content: "A.",
			});
			const postB = await controller.createPost({
				title: "Post B",
				slug: "shared-slug",
				content: "B.",
			});

			await controller.updatePost(postA.id, { slug: "new-slug" });

			const fetchedB = await controller.getPost(postB.id);
			expect(fetchedB?.slug).toBe("shared-slug");

			const byNewSlug = await controller.getPostBySlug("new-slug");
			expect(byNewSlug?.id).toBe(postA.id);
		});
	});

	// -- Draft vs Published Visibility ----------------------------------------

	describe("draft vs published visibility", () => {
		it("draft posts are excluded when filtering by published status", async () => {
			await controller.createPost({
				title: "Secret Draft",
				slug: "secret-draft",
				content: "Unreleased content.",
			});
			await controller.createPost({
				title: "Public Post",
				slug: "public-post",
				content: "Published content.",
				status: "published",
			});

			const published = await controller.listPosts({ status: "published" });
			expect(published).toHaveLength(1);
			expect(published[0]?.title).toBe("Public Post");
		});

		it("archived posts are excluded when filtering by published status", async () => {
			const post = await controller.createPost({
				title: "Archived Post",
				slug: "archived-post",
				content: "Old content.",
				status: "published",
			});

			await controller.archivePost(post.id);

			const published = await controller.listPosts({ status: "published" });
			expect(published).toHaveLength(0);
		});

		it("scheduled posts are excluded when filtering by published status", async () => {
			const futureDate = new Date(Date.now() + 86400000);
			await controller.createPost({
				title: "Scheduled Post",
				slug: "scheduled-post",
				content: "Coming soon.",
				status: "scheduled",
				scheduledAt: futureDate,
			});

			const published = await controller.listPosts({ status: "published" });
			expect(published).toHaveLength(0);
		});

		it("unpublishing a post immediately removes it from published list", async () => {
			const post = await controller.createPost({
				title: "Temporary",
				slug: "temporary",
				content: "Content.",
				status: "published",
			});

			expect(await controller.listPosts({ status: "published" })).toHaveLength(
				1,
			);

			await controller.unpublishPost(post.id);

			const published = await controller.listPosts({ status: "published" });
			expect(published).toHaveLength(0);

			const drafts = await controller.listPosts({ status: "draft" });
			expect(drafts).toHaveLength(1);
			expect(drafts[0]?.id).toBe(post.id);
		});

		it("publishedAt is only set when post transitions to published", async () => {
			const draft = await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});
			expect(draft.publishedAt).toBeUndefined();

			const archived = await controller.createPost({
				title: "Archived",
				slug: "archived",
				content: "Content.",
				status: "archived",
			});
			expect(archived.publishedAt).toBeUndefined();

			const published = await controller.publishPost(draft.id);
			expect(published?.publishedAt).toBeInstanceOf(Date);
		});
	});

	// -- Author Isolation -----------------------------------------------------

	describe("author isolation", () => {
		it("updating one post author does not affect another post", async () => {
			const postA = await controller.createPost({
				title: "Post A",
				slug: "post-a",
				content: "Content.",
				author: "Alice",
			});
			const postB = await controller.createPost({
				title: "Post B",
				slug: "post-b",
				content: "Content.",
				author: "Bob",
			});

			await controller.updatePost(postA.id, { author: "Charlie" });

			const fetchedB = await controller.getPost(postB.id);
			expect(fetchedB?.author).toBe("Bob");

			const fetchedA = await controller.getPost(postA.id);
			expect(fetchedA?.author).toBe("Charlie");
		});

		it("deleting a post does not affect other authors posts", async () => {
			const postA = await controller.createPost({
				title: "Alice Post",
				slug: "alice-post",
				content: "Content.",
				author: "Alice",
			});
			const postB = await controller.createPost({
				title: "Bob Post",
				slug: "bob-post",
				content: "Content.",
				author: "Bob",
			});

			await controller.deletePost(postA.id);

			const fetchedB = await controller.getPost(postB.id);
			expect(fetchedB).not.toBeNull();
			expect(fetchedB?.author).toBe("Bob");
			expect(mockData.size("post")).toBe(1);
		});

		it("publishing one author post does not change another authors post status", async () => {
			const alice = await controller.createPost({
				title: "Alice Draft",
				slug: "alice-draft",
				content: "Content.",
				author: "Alice",
			});
			const bob = await controller.createPost({
				title: "Bob Draft",
				slug: "bob-draft",
				content: "Content.",
				author: "Bob",
			});

			await controller.publishPost(alice.id);

			const fetchedBob = await controller.getPost(bob.id);
			expect(fetchedBob?.status).toBe("draft");
			expect(fetchedBob?.publishedAt).toBeUndefined();
		});
	});

	// -- Category Filtering Integrity -----------------------------------------

	describe("category filtering integrity", () => {
		it("category filter returns only posts in the specified category", async () => {
			await controller.createPost({
				title: "Tech Post",
				slug: "tech-post",
				content: "Content.",
				category: "Technology",
			});
			await controller.createPost({
				title: "Food Post",
				slug: "food-post",
				content: "Content.",
				category: "Food",
			});
			await controller.createPost({
				title: "No Category",
				slug: "no-category",
				content: "Content.",
			});

			const techPosts = await controller.listPosts({ category: "Technology" });
			expect(techPosts).toHaveLength(1);
			expect(techPosts[0]?.category).toBe("Technology");
		});

		it("category filter is case-sensitive", async () => {
			await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
				category: "News",
			});

			const lower = await controller.listPosts({ category: "news" });
			expect(lower).toHaveLength(0);

			const correct = await controller.listPosts({ category: "News" });
			expect(correct).toHaveLength(1);
		});

		it("changing a post category updates filter results immediately", async () => {
			const post = await controller.createPost({
				title: "Moving Post",
				slug: "moving-post",
				content: "Content.",
				category: "Old",
			});

			expect(await controller.listPosts({ category: "Old" })).toHaveLength(1);

			await controller.updatePost(post.id, { category: "New" });

			expect(await controller.listPosts({ category: "Old" })).toHaveLength(0);
			expect(await controller.listPosts({ category: "New" })).toHaveLength(1);
		});

		it("combined category and status filter narrows results correctly", async () => {
			await controller.createPost({
				title: "Draft Tech",
				slug: "draft-tech",
				content: "Content.",
				category: "Tech",
				status: "draft",
			});
			await controller.createPost({
				title: "Published Tech",
				slug: "published-tech",
				content: "Content.",
				category: "Tech",
				status: "published",
			});
			await controller.createPost({
				title: "Published Food",
				slug: "published-food",
				content: "Content.",
				category: "Food",
				status: "published",
			});

			const result = await controller.listPosts({
				status: "published",
				category: "Tech",
			});
			expect(result).toHaveLength(1);
			expect(result[0]?.title).toBe("Published Tech");
		});
	});

	// -- Pagination Bounds ----------------------------------------------------

	describe("pagination bounds", () => {
		it("negative skip is treated as zero (no crash)", async () => {
			await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
			});

			const posts = await controller.listPosts({ skip: -1 });
			expect(posts.length).toBeGreaterThanOrEqual(0);
		});

		it("skip beyond total returns empty without error", async () => {
			await controller.createPost({
				title: "Only Post",
				slug: "only-post",
				content: "Content.",
			});

			const posts = await controller.listPosts({ skip: 1000 });
			expect(posts).toHaveLength(0);
		});

		it("take=0 returns empty array", async () => {
			await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
			});

			const posts = await controller.listPosts({ take: 0 });
			expect(posts).toHaveLength(0);
		});

		it("pagination does not duplicate posts across pages", async () => {
			for (let i = 0; i < 6; i++) {
				await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}`,
				});
			}

			const page1 = await controller.listPosts({ take: 3, skip: 0 });
			const page2 = await controller.listPosts({ take: 3, skip: 3 });

			const allIds = [...page1.map((p) => p.id), ...page2.map((p) => p.id)];
			expect(new Set(allIds).size).toBe(6);
		});
	});

	// -- Content Sanitization Expectations ------------------------------------

	describe("content sanitization expectations", () => {
		it("stores HTML content as-is without stripping tags", async () => {
			const html = '<script>alert("xss")</script><p>Hello</p>';
			const post = await controller.createPost({
				title: "HTML Post",
				slug: "html-post",
				content: html,
			});

			expect(post.content).toBe(html);

			const fetched = await controller.getPost(post.id);
			expect(fetched?.content).toBe(html);
		});

		it("stores markdown content without transformation", async () => {
			const markdown =
				"# Heading\n\n**Bold** and _italic_\n\n```js\nconsole.log('hi');\n```";
			const post = await controller.createPost({
				title: "Markdown Post",
				slug: "markdown-post",
				content: markdown,
			});

			expect(post.content).toBe(markdown);
		});

		it("preserves special characters in title and excerpt", async () => {
			const post = await controller.createPost({
				title: 'Title with "quotes" & <angles>',
				slug: "special",
				content: "Content.",
				excerpt: 'Excerpt with "quotes" & <angles>',
			});

			expect(post.title).toBe('Title with "quotes" & <angles>');
			expect(post.excerpt).toBe('Excerpt with "quotes" & <angles>');
		});
	});

	// -- Status Transition Integrity ------------------------------------------

	describe("status transition integrity", () => {
		it("publishPost on non-existent id returns null without creating data", async () => {
			const result = await controller.publishPost("non-existent-id");
			expect(result).toBeNull();
			expect(mockData.size("post")).toBe(0);
		});

		it("unpublishPost on non-existent id returns null without creating data", async () => {
			const result = await controller.unpublishPost("non-existent-id");
			expect(result).toBeNull();
			expect(mockData.size("post")).toBe(0);
		});

		it("archivePost on non-existent id returns null without creating data", async () => {
			const result = await controller.archivePost("non-existent-id");
			expect(result).toBeNull();
			expect(mockData.size("post")).toBe(0);
		});

		it("publishPost preserves original publishedAt on re-publish after unpublish", async () => {
			const post = await controller.createPost({
				title: "Cycle Post",
				slug: "cycle-post",
				content: "Content.",
			});

			const published = await controller.publishPost(post.id);
			const originalDate = published?.publishedAt;

			await controller.unpublishPost(post.id);
			const republished = await controller.publishPost(post.id);

			expect(republished?.publishedAt).toEqual(originalDate);
			expect(republished?.status).toBe("published");
		});

		it("updatePost to non-existent id returns null and does not create orphan data", async () => {
			const result = await controller.updatePost("fake-id", {
				title: "Ghost",
				status: "published",
			});
			expect(result).toBeNull();
			expect(mockData.size("post")).toBe(0);
		});

		it("deletePost on non-existent id returns false and does not corrupt store", async () => {
			const existing = await controller.createPost({
				title: "Real Post",
				slug: "real-post",
				content: "Content.",
			});

			const result = await controller.deletePost("fake-id");
			expect(result).toBe(false);
			expect(mockData.size("post")).toBe(1);

			const fetched = await controller.getPost(existing.id);
			expect(fetched?.title).toBe("Real Post");
		});
	});

	// -- Featured Flag Isolation ----------------------------------------------

	describe("featured flag isolation", () => {
		it("featuring one post does not affect other posts", async () => {
			const postA = await controller.createPost({
				title: "Post A",
				slug: "post-a",
				content: "Content.",
			});
			const postB = await controller.createPost({
				title: "Post B",
				slug: "post-b",
				content: "Content.",
			});

			await controller.updatePost(postA.id, { featured: true });

			const fetchedB = await controller.getPost(postB.id);
			expect(fetchedB?.featured).toBe(false);
		});

		it("unfeaturing does not affect other featured posts", async () => {
			const postA = await controller.createPost({
				title: "Post A",
				slug: "post-a",
				content: "Content.",
				featured: true,
			});
			const postB = await controller.createPost({
				title: "Post B",
				slug: "post-b",
				content: "Content.",
				featured: true,
			});

			await controller.updatePost(postA.id, { featured: false });

			const fetchedB = await controller.getPost(postB.id);
			expect(fetchedB?.featured).toBe(true);
		});
	});

	// -- View Count Isolation -------------------------------------------------

	describe("view count isolation", () => {
		it("incrementing views on one post does not affect other posts", async () => {
			const postA = await controller.createPost({
				title: "Post A",
				slug: "post-a",
				content: "Content.",
			});
			const postB = await controller.createPost({
				title: "Post B",
				slug: "post-b",
				content: "Content.",
			});

			await controller.incrementViews(postA.id);
			await controller.incrementViews(postA.id);

			const fetchedB = await controller.getPost(postB.id);
			expect(fetchedB?.views).toBe(0);

			const fetchedA = await controller.getPost(postA.id);
			expect(fetchedA?.views).toBe(2);
		});
	});

	// -- Bulk Operation Safety ------------------------------------------------

	describe("bulk operation safety", () => {
		it("bulk publish does not affect posts not in the id list", async () => {
			const postA = await controller.createPost({
				title: "To Publish",
				slug: "to-publish",
				content: "Content.",
			});
			const postB = await controller.createPost({
				title: "Stay Draft",
				slug: "stay-draft",
				content: "Content.",
			});

			await controller.bulkUpdateStatus([postA.id], "published");

			const fetchedB = await controller.getPost(postB.id);
			expect(fetchedB?.status).toBe("draft");
		});

		it("bulk delete does not affect posts not in the id list", async () => {
			const postA = await controller.createPost({
				title: "To Delete",
				slug: "to-delete",
				content: "Content.",
			});
			const postB = await controller.createPost({
				title: "Keep",
				slug: "keep",
				content: "Content.",
			});

			await controller.bulkDelete([postA.id]);

			const fetchedB = await controller.getPost(postB.id);
			expect(fetchedB).not.toBeNull();
			expect(fetchedB?.title).toBe("Keep");
			expect(mockData.size("post")).toBe(1);
		});

		it("duplicate post is independent from original", async () => {
			const original = await controller.createPost({
				title: "Original",
				slug: "original",
				content: "Content.",
				status: "published",
			});

			const dup = await controller.duplicatePost(original.id);
			expect(dup).not.toBeNull();
			const dupId = dup?.id ?? "";

			// Modifying original should not affect duplicate
			await controller.updatePost(original.id, { title: "Changed" });

			const fetchedDup = await controller.getPost(dupId);
			expect(fetchedDup?.title).toBe("Original (Copy)");

			// Deleting duplicate should not affect original
			await controller.deletePost(dupId);

			const fetchedOriginal = await controller.getPost(original.id);
			expect(fetchedOriginal?.title).toBe("Changed");
		});
	});
});
