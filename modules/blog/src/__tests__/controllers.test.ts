import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createBlogController } from "../service-impl";

describe("blog controller edge cases", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createBlogController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createBlogController(mockData);
	});

	// ── createPost edge cases ──────────────────────────────────────────

	describe("createPost edge cases", () => {
		it("each created post gets a unique id", async () => {
			const ids = new Set<string>();
			for (let i = 0; i < 20; i++) {
				const post = await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}`,
				});
				ids.add(post.id);
			}
			expect(ids.size).toBe(20);
		});

		it("createdAt and updatedAt are set to approximately current time", async () => {
			const before = new Date();
			const post = await controller.createPost({
				title: "Timestamp Test",
				slug: "timestamp-test",
				content: "Content.",
			});
			const after = new Date();
			expect(post.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(post.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
			expect(post.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(post.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("auto-generates slug from title with special characters", async () => {
			const post = await controller.createPost({
				title: "Hello, World! @#$%^&*()",
				slug: "",
				content: "Content.",
			});
			expect(post.slug).toBe("hello-world");
		});

		it("auto-generates slug stripping leading/trailing hyphens", async () => {
			const post = await controller.createPost({
				title: "---Leading and Trailing---",
				slug: "",
				content: "Content.",
			});
			expect(post.slug).toBe("leading-and-trailing");
		});

		it("auto-generates slug collapsing consecutive special chars", async () => {
			const post = await controller.createPost({
				title: "Multiple   Spaces   Here",
				slug: "",
				content: "Content.",
			});
			expect(post.slug).toBe("multiple-spaces-here");
		});

		it("handles empty string content", async () => {
			const post = await controller.createPost({
				title: "Empty Content",
				slug: "empty-content",
				content: "",
			});
			expect(post.content).toBe("");
		});

		it("handles very long title and content", async () => {
			const longTitle = "A".repeat(10000);
			const longContent = "B".repeat(50000);
			const post = await controller.createPost({
				title: longTitle,
				slug: "long-post",
				content: longContent,
			});
			expect(post.title).toBe(longTitle);
			expect(post.content).toBe(longContent);
		});

		it("handles special characters in title and content", async () => {
			const post = await controller.createPost({
				title: 'Post "with" <html> & entities',
				slug: "special-chars",
				content: "Content with\nnewlines\tand\ttabs @#$%^&*()",
			});
			expect(post.title).toBe('Post "with" <html> & entities');
			expect(post.content).toBe("Content with\nnewlines\tand\ttabs @#$%^&*()");
		});

		it("handles unicode and emoji in content", async () => {
			const post = await controller.createPost({
				title: "Cafe\u0301 Post",
				slug: "unicode-post",
				content: "Hello \u{1F600}\u{1F389}\u{1F680}",
			});
			expect(post.title).toBe("Cafe\u0301 Post");
			expect(post.content).toBe("Hello \u{1F600}\u{1F389}\u{1F680}");
		});

		it("creates archived post without publishedAt", async () => {
			const post = await controller.createPost({
				title: "Archived Post",
				slug: "archived-post",
				content: "Content.",
				status: "archived",
			});
			expect(post.status).toBe("archived");
			expect(post.publishedAt).toBeUndefined();
		});

		it("handles tags with special characters", async () => {
			const post = await controller.createPost({
				title: "Special Tags",
				slug: "special-tags",
				content: "Content.",
				tags: ["c++", "c#", "node.js", "a tag with spaces"],
			});
			expect(post.tags).toEqual(["c++", "c#", "node.js", "a tag with spaces"]);
		});

		it("handles very many tags", async () => {
			const tags = Array.from({ length: 100 }, (_, i) => `tag-${i}`);
			const post = await controller.createPost({
				title: "Many Tags",
				slug: "many-tags",
				content: "Content.",
				tags,
			});
			expect(post.tags).toHaveLength(100);
		});

		it("reading time strips HTML tags before counting", async () => {
			const post = await controller.createPost({
				title: "HTML Post",
				slug: "html-post",
				content: "<p>Just a few words here.</p><div>And some more.</div>",
			});
			expect(post.readingTime).toBe(1);
		});

		it("reading time strips markdown syntax before counting", async () => {
			const words = Array(250).fill("word").join(" ");
			const post = await controller.createPost({
				title: "Markdown Post",
				slug: "markdown-post",
				content: `# Title\n\n**${words}**\n\n- item\n- item`,
			});
			expect(post.readingTime).toBe(2);
		});
	});

	// ── updatePost edge cases ──────────────────────────────────────────

	describe("updatePost edge cases", () => {
		it("updates only the slug without touching other fields", async () => {
			const created = await controller.createPost({
				title: "Original",
				slug: "original",
				content: "Original content.",
				excerpt: "Original excerpt",
				author: "Author",
				tags: ["tag1"],
				category: "Cat1",
			});

			const updated = await controller.updatePost(created.id, {
				slug: "new-slug",
			});

			expect(updated?.slug).toBe("new-slug");
			expect(updated?.title).toBe("Original");
			expect(updated?.content).toBe("Original content.");
			expect(updated?.excerpt).toBe("Original excerpt");
			expect(updated?.author).toBe("Author");
			expect(updated?.tags).toEqual(["tag1"]);
			expect(updated?.category).toBe("Cat1");
		});

		it("updates tags to empty array", async () => {
			const created = await controller.createPost({
				title: "Tagged",
				slug: "tagged",
				content: "Content.",
				tags: ["tag1", "tag2", "tag3"],
			});

			const updated = await controller.updatePost(created.id, {
				tags: [],
			});

			expect(updated?.tags).toEqual([]);
		});

		it("sets publishedAt when transitioning from archived to published", async () => {
			const created = await controller.createPost({
				title: "Archived",
				slug: "archived",
				content: "Content.",
				status: "archived",
			});

			expect(created.publishedAt).toBeUndefined();

			const updated = await controller.updatePost(created.id, {
				status: "published",
			});

			expect(updated?.status).toBe("published");
			expect(updated?.publishedAt).toBeInstanceOf(Date);
		});

		it("does not change publishedAt when updating published post to published", async () => {
			const created = await controller.createPost({
				title: "Published",
				slug: "published",
				content: "Content.",
				status: "published",
			});

			const originalPublishedAt = created.publishedAt;
			const updated = await controller.updatePost(created.id, {
				status: "published",
			});

			expect(updated?.publishedAt).toEqual(originalPublishedAt);
		});

		it("multiple sequential updates accumulate correctly", async () => {
			const created = await controller.createPost({
				title: "V1",
				slug: "versioned",
				content: "Content v1.",
			});

			await controller.updatePost(created.id, { title: "V2" });
			await controller.updatePost(created.id, { content: "Content v3." });
			const final = await controller.updatePost(created.id, {
				excerpt: "Summary",
			});

			expect(final?.title).toBe("V2");
			expect(final?.content).toBe("Content v3.");
			expect(final?.excerpt).toBe("Summary");
		});

		it("update with empty params object still updates updatedAt", async () => {
			const created = await controller.createPost({
				title: "No Change",
				slug: "no-change",
				content: "Content.",
			});

			const updated = await controller.updatePost(created.id, {});

			expect(updated).not.toBeNull();
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});

		it("returns null and does not create data for non-existent id", async () => {
			const updated = await controller.updatePost("non-existent-id", {
				title: "Nope",
			});
			expect(updated).toBeNull();
			expect(mockData.size("post")).toBe(0);
		});
	});

	// ── deletePost edge cases ──────────────────────────────────────────

	describe("deletePost edge cases", () => {
		it("double deletion returns false on second attempt", async () => {
			const post = await controller.createPost({
				title: "Delete Me",
				slug: "delete-me",
				content: "Content.",
			});
			expect(await controller.deletePost(post.id)).toBe(true);
			expect(await controller.deletePost(post.id)).toBe(false);
		});

		it("deleting one post does not affect other posts", async () => {
			const post1 = await controller.createPost({
				title: "Post 1",
				slug: "post-1",
				content: "Content 1.",
			});
			const post2 = await controller.createPost({
				title: "Post 2",
				slug: "post-2",
				content: "Content 2.",
			});

			await controller.deletePost(post1.id);

			const remaining = await controller.getPost(post2.id);
			expect(remaining).not.toBeNull();
			expect(remaining?.title).toBe("Post 2");
			expect(mockData.size("post")).toBe(1);
		});

		it("returns false for empty string id", async () => {
			const result = await controller.deletePost("");
			expect(result).toBe(false);
		});

		it("getPostBySlug returns null after deletion", async () => {
			const post = await controller.createPost({
				title: "Post",
				slug: "post-slug",
				content: "Content.",
			});
			await controller.deletePost(post.id);
			expect(await controller.getPostBySlug("post-slug")).toBeNull();
		});
	});

	// ── getPost / getPostBySlug edge cases ─────────────────────────────

	describe("getPost / getPostBySlug edge cases", () => {
		it("returns correct post when many posts exist", async () => {
			const posts: Awaited<ReturnType<typeof controller.createPost>>[] = [];
			for (let i = 0; i < 20; i++) {
				const post = await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}`,
				});
				posts.push(post);
			}
			const fetched = await controller.getPost(posts[10].id);
			expect(fetched).not.toBeNull();
			expect(fetched?.title).toBe("Post 10");
		});

		it("returns null for empty string id and slug", async () => {
			expect(await controller.getPost("")).toBeNull();
			expect(await controller.getPostBySlug("")).toBeNull();
		});

		it("slug lookup is case-sensitive", async () => {
			await controller.createPost({
				title: "Post",
				slug: "my-slug",
				content: "Content.",
			});
			expect(await controller.getPostBySlug("My-Slug")).toBeNull();
		});

		it("handles slug with only hyphens", async () => {
			await controller.createPost({
				title: "Hyphen Slug",
				slug: "---",
				content: "Content.",
			});
			const found = await controller.getPostBySlug("---");
			expect(found).not.toBeNull();
			expect(found?.title).toBe("Hyphen Slug");
		});
	});

	// ── publishPost edge cases ─────────────────────────────────────────

	describe("publishPost edge cases", () => {
		it("publishing an archived post sets publishedAt if not previously set", async () => {
			const post = await controller.createPost({
				title: "Archived",
				slug: "archived",
				content: "Content.",
				status: "archived",
			});
			expect(post.publishedAt).toBeUndefined();

			const published = await controller.publishPost(post.id);
			expect(published?.status).toBe("published");
			expect(published?.publishedAt).toBeInstanceOf(Date);
		});

		it("publishPost updates updatedAt timestamp", async () => {
			const post = await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});
			const published = await controller.publishPost(post.id);
			expect(published?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				post.updatedAt.getTime(),
			);
		});

		it("returns null for empty string id", async () => {
			expect(await controller.publishPost("")).toBeNull();
		});
	});

	// ── unpublishPost edge cases ───────────────────────────────────────

	describe("unpublishPost edge cases", () => {
		it("unpublishing a draft post keeps it as draft", async () => {
			const post = await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});
			const unpublished = await controller.unpublishPost(post.id);
			expect(unpublished?.status).toBe("draft");
		});

		it("unpublishing preserves publishedAt from original publish", async () => {
			const post = await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
				status: "published",
			});
			const originalPublishedAt = post.publishedAt;
			const unpublished = await controller.unpublishPost(post.id);
			expect(unpublished?.publishedAt).toEqual(originalPublishedAt);
		});

		it("returns null for empty string id", async () => {
			expect(await controller.unpublishPost("")).toBeNull();
		});
	});

	// ── archivePost edge cases ─────────────────────────────────────────

	describe("archivePost edge cases", () => {
		it("archiving an already archived post keeps archived status", async () => {
			const post = await controller.createPost({
				title: "Archived",
				slug: "archived",
				content: "Content.",
				status: "archived",
			});
			const rearchived = await controller.archivePost(post.id);
			expect(rearchived?.status).toBe("archived");
		});

		it("archivePost updates updatedAt timestamp", async () => {
			const post = await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
			});
			const archived = await controller.archivePost(post.id);
			expect(archived?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				post.updatedAt.getTime(),
			);
		});

		it("returns null for empty string id", async () => {
			expect(await controller.archivePost("")).toBeNull();
		});
	});

	// ── duplicatePost edge cases ───────────────────────────────────────

	describe("duplicatePost edge cases", () => {
		it("duplicate preserves content and tags", async () => {
			const original = await controller.createPost({
				title: "Original",
				slug: "original",
				content: "Some content.",
				tags: ["a", "b"],
				category: "Cat",
				metaTitle: "Meta",
				metaDescription: "Desc",
			});

			const dup = await controller.duplicatePost(original.id);
			expect(dup?.content).toBe("Some content.");
			expect(dup?.tags).toEqual(["a", "b"]);
			expect(dup?.category).toBe("Cat");
			expect(dup?.metaTitle).toBe("Meta");
			expect(dup?.metaDescription).toBe("Desc");
		});

		it("duplicate resets views to 0", async () => {
			const original = await controller.createPost({
				title: "Popular",
				slug: "popular",
				content: "Content.",
			});
			await controller.incrementViews(original.id);
			await controller.incrementViews(original.id);

			const dup = await controller.duplicatePost(original.id);
			expect(dup?.views).toBe(0);
		});

		it("duplicate does not increment data store beyond 1 new record", async () => {
			const original = await controller.createPost({
				title: "Original",
				slug: "original",
				content: "Content.",
			});

			await controller.duplicatePost(original.id);
			expect(mockData.size("post")).toBe(2);
		});
	});

	// ── incrementViews edge cases ──────────────────────────────────────

	describe("incrementViews edge cases", () => {
		it("many increments accumulate correctly", async () => {
			const post = await controller.createPost({
				title: "Viral",
				slug: "viral",
				content: "Content.",
			});

			for (let i = 0; i < 50; i++) {
				await controller.incrementViews(post.id);
			}

			const fetched = await controller.getPost(post.id);
			expect(fetched?.views).toBe(50);
		});

		it("incrementing does not change other fields", async () => {
			const post = await controller.createPost({
				title: "Stable",
				slug: "stable",
				content: "Content.",
				tags: ["tag"],
				featured: true,
			});

			await controller.incrementViews(post.id);

			const fetched = await controller.getPost(post.id);
			expect(fetched?.title).toBe("Stable");
			expect(fetched?.tags).toEqual(["tag"]);
			expect(fetched?.featured).toBe(true);
		});
	});

	// ── listPosts edge cases ───────────────────────────────────────────

	describe("listPosts edge cases", () => {
		it("returns empty array with take=0", async () => {
			await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
			});
			const posts = await controller.listPosts({ take: 0 });
			expect(posts).toHaveLength(0);
		});

		it("returns empty array when skip exceeds total posts", async () => {
			await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
			});
			const posts = await controller.listPosts({ skip: 100 });
			expect(posts).toHaveLength(0);
		});

		it("handles take larger than total posts", async () => {
			await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
			});
			const posts = await controller.listPosts({ take: 100 });
			expect(posts).toHaveLength(1);
		});

		it("paginates correctly through all posts", async () => {
			for (let i = 0; i < 7; i++) {
				await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}`,
				});
			}
			const page1 = await controller.listPosts({ take: 3, skip: 0 });
			const page2 = await controller.listPosts({ take: 3, skip: 3 });
			const page3 = await controller.listPosts({ take: 3, skip: 6 });
			expect(page1).toHaveLength(3);
			expect(page2).toHaveLength(3);
			expect(page3).toHaveLength(1);
			const allIds = [
				...page1.map((p) => p.id),
				...page2.map((p) => p.id),
				...page3.map((p) => p.id),
			];
			expect(new Set(allIds).size).toBe(7);
		});

		it("returns all posts with empty params object", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}`,
				});
			}
			const posts = await controller.listPosts({});
			expect(posts).toHaveLength(3);
		});

		it("tag filter returns empty when no posts have the tag", async () => {
			await controller.createPost({
				title: "Post",
				slug: "post",
				content: "Content.",
				tags: ["javascript", "react"],
			});
			const posts = await controller.listPosts({ tag: "python" });
			expect(posts).toHaveLength(0);
		});

		it("tag filter combined with status filter", async () => {
			await controller.createPost({
				title: "Draft JS",
				slug: "draft-js",
				content: "Content.",
				tags: ["javascript"],
				status: "draft",
			});
			await controller.createPost({
				title: "Published JS",
				slug: "published-js",
				content: "Content.",
				tags: ["javascript"],
				status: "published",
			});
			await controller.createPost({
				title: "Published Python",
				slug: "published-python",
				content: "Content.",
				tags: ["python"],
				status: "published",
			});

			const posts = await controller.listPosts({
				status: "published",
				tag: "javascript",
			});
			expect(posts).toHaveLength(1);
			expect(posts[0].title).toBe("Published JS");
		});

		it("tag filter combined with category filter", async () => {
			await controller.createPost({
				title: "News JS",
				slug: "news-js",
				content: "Content.",
				tags: ["javascript"],
				category: "News",
			});
			await controller.createPost({
				title: "Guide JS",
				slug: "guide-js",
				content: "Content.",
				tags: ["javascript"],
				category: "Guides",
			});
			await controller.createPost({
				title: "News Python",
				slug: "news-python",
				content: "Content.",
				tags: ["python"],
				category: "News",
			});

			const posts = await controller.listPosts({
				category: "News",
				tag: "javascript",
			});
			expect(posts).toHaveLength(1);
			expect(posts[0].title).toBe("News JS");
		});

		it("reflects deletions in subsequent list calls", async () => {
			const post = await controller.createPost({
				title: "Post 1",
				slug: "post-1",
				content: "Content.",
			});
			await controller.createPost({
				title: "Post 2",
				slug: "post-2",
				content: "Content.",
			});

			expect(await controller.listPosts()).toHaveLength(2);
			await controller.deletePost(post.id);
			const after = await controller.listPosts();
			expect(after).toHaveLength(1);
			expect(after[0].title).toBe("Post 2");
		});

		it("reflects status changes in filtered list calls", async () => {
			const post = await controller.createPost({
				title: "Draft Post",
				slug: "draft-post",
				content: "Content.",
			});

			expect(await controller.listPosts({ status: "draft" })).toHaveLength(1);
			expect(await controller.listPosts({ status: "published" })).toHaveLength(
				0,
			);

			await controller.publishPost(post.id);

			expect(await controller.listPosts({ status: "draft" })).toHaveLength(0);
			expect(await controller.listPosts({ status: "published" })).toHaveLength(
				1,
			);
		});

		it("handles tag filter with pagination", async () => {
			for (let i = 0; i < 5; i++) {
				await controller.createPost({
					title: `Tagged Post ${i}`,
					slug: `tagged-post-${i}`,
					content: `Content ${i}`,
					tags: ["common"],
				});
			}
			await controller.createPost({
				title: "Untagged",
				slug: "untagged",
				content: "Content.",
				tags: ["other"],
			});

			const posts = await controller.listPosts({ tag: "common", take: 3 });
			expect(posts).toHaveLength(3);
		});

		it("search returns empty for no matches", async () => {
			await controller.createPost({
				title: "React Post",
				slug: "react",
				content: "Content about React.",
			});

			const results = await controller.listPosts({ search: "angular" });
			expect(results).toHaveLength(0);
		});

		it("search combined with other filters", async () => {
			await controller.createPost({
				title: "React Draft",
				slug: "react-draft",
				content: "Content.",
				status: "draft",
			});
			await controller.createPost({
				title: "React Published",
				slug: "react-published",
				content: "Content.",
				status: "published",
			});

			const results = await controller.listPosts({
				search: "react",
				status: "published",
			});
			expect(results).toHaveLength(1);
			expect(results[0].title).toBe("React Published");
		});
	});

	// ── lifecycle transition edge cases ────────────────────────────────

	describe("lifecycle transition edge cases", () => {
		it("draft -> archived -> published -> draft full cycle", async () => {
			const post = await controller.createPost({
				title: "Cycle",
				slug: "cycle",
				content: "Content.",
			});
			expect(post.status).toBe("draft");

			const archived = await controller.archivePost(post.id);
			expect(archived?.status).toBe("archived");

			const published = await controller.publishPost(post.id);
			expect(published?.status).toBe("published");
			expect(published?.publishedAt).toBeInstanceOf(Date);

			const draft = await controller.unpublishPost(post.id);
			expect(draft?.status).toBe("draft");
		});

		it("archived -> draft via updatePost", async () => {
			const post = await controller.createPost({
				title: "Archived",
				slug: "archived",
				content: "Content.",
				status: "archived",
			});

			const updated = await controller.updatePost(post.id, {
				status: "draft",
			});
			expect(updated?.status).toBe("draft");
		});

		it("rapid publish/unpublish cycle preserves original publishedAt", async () => {
			const post = await controller.createPost({
				title: "Rapid",
				slug: "rapid",
				content: "Content.",
			});

			const published = await controller.publishPost(post.id);
			const originalPublishedAt = published?.publishedAt;

			await controller.unpublishPost(post.id);
			const republished = await controller.publishPost(post.id);

			expect(republished?.publishedAt).toEqual(originalPublishedAt);
		});
	});

	// ── concurrent operations ──────────────────────────────────────────

	describe("concurrent operations", () => {
		it("concurrent creates produce distinct posts", async () => {
			const promises = Array.from({ length: 10 }, (_, i) =>
				controller.createPost({
					title: `Concurrent ${i}`,
					slug: `concurrent-${i}`,
					content: `Content ${i}`,
				}),
			);
			const posts = await Promise.all(promises);
			const ids = new Set(posts.map((p) => p.id));
			expect(ids.size).toBe(10);
			expect(mockData.size("post")).toBe(10);
		});

		it("concurrent reads do not interfere", async () => {
			const post = await controller.createPost({
				title: "Read Target",
				slug: "read-target",
				content: "Content.",
			});

			const promises = Array.from({ length: 10 }, () =>
				controller.getPost(post.id),
			);
			const results = await Promise.all(promises);

			for (const result of results) {
				expect(result).not.toBeNull();
				expect(result?.title).toBe("Read Target");
			}
		});

		it("concurrent listPosts with different filters", async () => {
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

			const [drafts, published, all] = await Promise.all([
				controller.listPosts({ status: "draft" }),
				controller.listPosts({ status: "published" }),
				controller.listPosts(),
			]);

			expect(drafts).toHaveLength(1);
			expect(published).toHaveLength(1);
			expect(all).toHaveLength(2);
		});
	});

	// ── data store consistency ──────────────────────────────────────────

	describe("data store consistency", () => {
		it("store is empty after deleting all posts", async () => {
			const posts: Awaited<ReturnType<typeof controller.createPost>>[] = [];
			for (let i = 0; i < 3; i++) {
				const post = await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}`,
				});
				posts.push(post);
			}
			for (const post of posts) {
				await controller.deletePost(post.id);
			}
			expect(mockData.size("post")).toBe(0);
		});

		it("update persists to the data store", async () => {
			const post = await controller.createPost({
				title: "Original",
				slug: "original",
				content: "Content.",
			});

			await controller.updatePost(post.id, { title: "Updated" });

			const raw = await mockData.get("post", post.id);
			expect(raw).not.toBeNull();
			expect((raw as Record<string, unknown>).title).toBe("Updated");
		});

		it("publishPost persists status change to the data store", async () => {
			const post = await controller.createPost({
				title: "Draft",
				slug: "draft",
				content: "Content.",
			});

			await controller.publishPost(post.id);

			const raw = await mockData.get("post", post.id);
			expect((raw as Record<string, unknown>).status).toBe("published");
		});

		it("bulkDelete removes all specified posts from store", async () => {
			const ids: string[] = [];
			for (let i = 0; i < 5; i++) {
				const post = await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}`,
				});
				ids.push(post.id);
			}

			await controller.bulkDelete(ids.slice(0, 3));
			expect(mockData.size("post")).toBe(2);
		});
	});

	// ── boundary / stress ──────────────────────────────────────────────

	describe("boundary conditions", () => {
		it("handles 100 posts", async () => {
			for (let i = 0; i < 100; i++) {
				await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}`,
				});
			}
			expect(mockData.size("post")).toBe(100);
			const all = await controller.listPosts();
			expect(all).toHaveLength(100);
		});

		it("pagination at exact boundary returns empty next page", async () => {
			for (let i = 0; i < 10; i++) {
				await controller.createPost({
					title: `Post ${i}`,
					slug: `post-${i}`,
					content: `Content ${i}`,
				});
			}
			const page = await controller.listPosts({ take: 10, skip: 0 });
			expect(page).toHaveLength(10);
			const nextPage = await controller.listPosts({ take: 10, skip: 10 });
			expect(nextPage).toHaveLength(0);
		});

		it("single post full lifecycle", async () => {
			const post = await controller.createPost({
				title: "Solo",
				slug: "solo",
				content: "Content.",
			});

			expect((await controller.getPost(post.id))?.title).toBe("Solo");
			expect((await controller.getPostBySlug("solo"))?.id).toBe(post.id);

			const updated = await controller.updatePost(post.id, {
				title: "Solo Updated",
			});
			expect(updated?.title).toBe("Solo Updated");

			expect((await controller.publishPost(post.id))?.status).toBe("published");
			expect((await controller.unpublishPost(post.id))?.status).toBe("draft");
			expect((await controller.archivePost(post.id))?.status).toBe("archived");
			expect(await controller.listPosts()).toHaveLength(1);
			expect(await controller.deletePost(post.id)).toBe(true);
			expect(await controller.listPosts()).toHaveLength(0);
		});
	});

	// ── slugify behavior ───────────────────────────────────────────────

	describe("slugify edge cases", () => {
		it("generates empty slug from all-special-characters title", async () => {
			const post = await controller.createPost({
				title: "@#$%^&*()",
				slug: "",
				content: "Content.",
			});
			expect(post.slug).toBe("");
		});

		it("generates slug from numeric title", async () => {
			const post = await controller.createPost({
				title: "123 456 789",
				slug: "",
				content: "Content.",
			});
			expect(post.slug).toBe("123-456-789");
		});

		it("preserves explicit slug verbatim", async () => {
			const post = await controller.createPost({
				title: "Post",
				slug: "my-custom-slug-123",
				content: "Content.",
			});
			expect(post.slug).toBe("my-custom-slug-123");
		});

		it("generates slug from mixed case and numbers", async () => {
			const post = await controller.createPost({
				title: "React 18 New Features",
				slug: "",
				content: "Content.",
			});
			expect(post.slug).toBe("react-18-new-features");
		});
	});

	// ── getStats edge cases ────────────────────────────────────────────

	describe("getStats edge cases", () => {
		it("handles posts without category", async () => {
			await controller.createPost({
				title: "No Category",
				slug: "no-cat",
				content: "Content.",
			});

			const stats = await controller.getStats();
			expect(stats.total).toBe(1);
			expect(stats.categories).toEqual([]);
		});

		it("handles posts without tags", async () => {
			await controller.createPost({
				title: "No Tags",
				slug: "no-tags",
				content: "Content.",
				tags: [],
			});

			const stats = await controller.getStats();
			expect(stats.total).toBe(1);
			expect(stats.tags).toEqual([]);
		});

		it("sorts categories and tags by count descending", async () => {
			for (let i = 0; i < 3; i++) {
				await controller.createPost({
					title: `Tech ${i}`,
					slug: `tech-${i}`,
					content: "Content.",
					category: "Tech",
					tags: ["react"],
				});
			}
			await controller.createPost({
				title: "News",
				slug: "news",
				content: "Content.",
				category: "News",
				tags: ["react", "vue"],
			});

			const stats = await controller.getStats();
			expect(stats.categories[0]?.category).toBe("Tech");
			expect(stats.categories[0]?.count).toBe(3);
			expect(stats.tags[0]?.tag).toBe("react");
			expect(stats.tags[0]?.count).toBe(4);
		});
	});

	// ── bulkUpdateStatus edge cases ────────────────────────────────────

	describe("bulkUpdateStatus edge cases", () => {
		it("handles empty array of ids", async () => {
			const result = await controller.bulkUpdateStatus([], "published");
			expect(result.updated).toBe(0);
			expect(result.failed).toEqual([]);
		});

		it("all non-existent ids are reported as failed", async () => {
			const result = await controller.bulkUpdateStatus(
				["fake-1", "fake-2"],
				"published",
			);
			expect(result.updated).toBe(0);
			expect(result.failed).toEqual(["fake-1", "fake-2"]);
		});
	});

	// ── bulkDelete edge cases ──────────────────────────────────────────

	describe("bulkDelete edge cases", () => {
		it("handles empty array of ids", async () => {
			const result = await controller.bulkDelete([]);
			expect(result.deleted).toBe(0);
			expect(result.failed).toEqual([]);
		});

		it("all non-existent ids are reported as failed", async () => {
			const result = await controller.bulkDelete(["fake-1", "fake-2"]);
			expect(result.deleted).toBe(0);
			expect(result.failed).toEqual(["fake-1", "fake-2"]);
		});
	});
});
