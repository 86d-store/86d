import { describe, expect, it, vi } from "vitest";
import { archivePostEndpoint } from "../admin/endpoints/archive-post";
import { bulkDeleteEndpoint } from "../admin/endpoints/bulk-delete";
import { bulkUpdateEndpoint } from "../admin/endpoints/bulk-update";
import { checkScheduledEndpoint } from "../admin/endpoints/check-scheduled";
import { createPostEndpoint } from "../admin/endpoints/create-post";
import { deletePostEndpoint } from "../admin/endpoints/delete-post";
import { duplicatePostEndpoint } from "../admin/endpoints/duplicate-post";
import { adminGetPostEndpoint } from "../admin/endpoints/get-post";
import { adminListPostsEndpoint } from "../admin/endpoints/list-posts";
import { publishPostEndpoint } from "../admin/endpoints/publish-post";
import { statsEndpoint } from "../admin/endpoints/stats";
import { unpublishPostEndpoint } from "../admin/endpoints/unpublish-post";
import { updatePostEndpoint } from "../admin/endpoints/update-post";
import type { BlogController, BlogPost, PostStats } from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makePost(overrides: Partial<BlogPost> = {}): BlogPost {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		title: "Hello World",
		slug: "hello-world",
		content: "# Hello World",
		status: "draft",
		tags: [],
		featured: false,
		readingTime: 1,
		views: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeController(
	overrides: Partial<BlogController> = {},
): BlogController {
	return {
		createPost: vi.fn().mockResolvedValue(makePost()),
		updatePost: vi.fn().mockResolvedValue(null),
		deletePost: vi.fn().mockResolvedValue(false),
		getPost: vi.fn().mockResolvedValue(null),
		getPostBySlug: vi.fn().mockResolvedValue(null),
		publishPost: vi.fn().mockResolvedValue(null),
		unpublishPost: vi.fn().mockResolvedValue(null),
		archivePost: vi.fn().mockResolvedValue(null),
		duplicatePost: vi.fn().mockResolvedValue(null),
		listPosts: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue({
			total: 0,
			draft: 0,
			published: 0,
			scheduled: 0,
			archived: 0,
			totalViews: 0,
			categories: [],
			tags: [],
		} satisfies PostStats),
		checkScheduledPosts: vi.fn().mockResolvedValue([]),
		bulkUpdateStatus: vi.fn().mockResolvedValue({ updated: 0, failed: [] }),
		bulkDelete: vi.fn().mockResolvedValue({ deleted: 0, failed: [] }),
		incrementViews: vi.fn().mockResolvedValue(null),
		getRelatedPosts: vi.fn().mockResolvedValue([]),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: BlogController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: { controllers: { blog: opts.controller ?? makeController() } },
	});
}

const listHandler = extractHandler(adminListPostsEndpoint);
const createHandler = extractHandler(createPostEndpoint);
const getHandler = extractHandler(adminGetPostEndpoint);
const updateHandler = extractHandler(updatePostEndpoint);
const deleteHandler = extractHandler(deletePostEndpoint);
const publishHandler = extractHandler(publishPostEndpoint);
const unpublishHandler = extractHandler(unpublishPostEndpoint);
const archiveHandler = extractHandler(archivePostEndpoint);
const duplicateHandler = extractHandler(duplicatePostEndpoint);
const bulkUpdateHandler = extractHandler(bulkUpdateEndpoint);
const bulkDeleteHandler = extractHandler(bulkDeleteEndpoint);
const checkScheduledHandler = extractHandler(checkScheduledEndpoint);
const statsHandler = extractHandler(statsEndpoint);

describe("admin GET /blog/posts", () => {
	it("returns empty list", async () => {
		const result = (await call(listHandler)) as { posts: BlogPost[] };
		expect(result.posts).toHaveLength(0);
	});

	it("forwards status filter", async () => {
		const ctrl = makeController();
		await call(listHandler, {
			query: { status: "published" },
			controller: ctrl,
		});
		expect(ctrl.listPosts).toHaveBeenCalledWith(
			expect.objectContaining({ status: "published" }),
		);
	});
});

describe("admin POST /blog/posts/create", () => {
	it("creates a post and returns it", async () => {
		const post = makePost({ title: "New Post" });
		const ctrl = makeController({
			createPost: vi.fn().mockResolvedValue(post),
		});
		const result = (await call(createHandler, {
			body: { title: "New Post", slug: "new-post", content: "content" },
			controller: ctrl,
		})) as { post: BlogPost };
		expect(result.post.title).toBe("New Post");
	});
});

describe("admin GET /blog/posts/:id", () => {
	it("returns null post when not found", async () => {
		const result = (await call(getHandler, {
			params: { id: "missing" },
		})) as { post: BlogPost | null };
		expect(result.post).toBeNull();
	});

	it("returns post when found", async () => {
		const post = makePost({ id: "p1" });
		const ctrl = makeController({ getPost: vi.fn().mockResolvedValue(post) });
		const result = (await call(getHandler, {
			params: { id: "p1" },
			controller: ctrl,
		})) as { post: BlogPost };
		expect(result.post.id).toBe("p1");
	});
});

describe("admin POST /blog/posts/:id/update", () => {
	it("returns null post when not found", async () => {
		const result = (await call(updateHandler, {
			params: { id: "missing" },
			body: { title: "X" },
		})) as { post: BlogPost | null };
		expect(result.post).toBeNull();
	});

	it("updates post", async () => {
		const post = makePost({ title: "Updated" });
		const ctrl = makeController({
			updatePost: vi.fn().mockResolvedValue(post),
		});
		const result = (await call(updateHandler, {
			params: { id: post.id },
			body: { title: "Updated" },
			controller: ctrl,
		})) as { post: BlogPost };
		expect(result.post.title).toBe("Updated");
	});
});

describe("admin DELETE /blog/posts/:id", () => {
	it("returns deleted=false when not found", async () => {
		const result = (await call(deleteHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes post and returns deleted=true", async () => {
		const ctrl = makeController({
			deletePost: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteHandler, {
			params: { id: "p1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

describe("admin POST /blog/posts/:id/publish", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(publishHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("publishes post", async () => {
		const post = makePost({ status: "published" });
		const ctrl = makeController({
			publishPost: vi.fn().mockResolvedValue(post),
		});
		const result = (await call(publishHandler, {
			params: { id: post.id },
			controller: ctrl,
		})) as { post: BlogPost };
		expect(result.post.status).toBe("published");
	});
});

describe("admin POST /blog/posts/:id/unpublish", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(unpublishHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});
});

describe("admin POST /blog/posts/:id/archive", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(archiveHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("archives post", async () => {
		const post = makePost({ status: "archived" });
		const ctrl = makeController({
			archivePost: vi.fn().mockResolvedValue(post),
		});
		const result = (await call(archiveHandler, {
			params: { id: post.id },
			controller: ctrl,
		})) as { post: BlogPost };
		expect(result.post.status).toBe("archived");
	});
});

describe("admin POST /blog/posts/:id/duplicate", () => {
	it("returns 404 when not found", async () => {
		const result = (await call(duplicateHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("duplicates post and returns it", async () => {
		const post = makePost({ title: "Hello World (copy)" });
		const ctrl = makeController({
			duplicatePost: vi.fn().mockResolvedValue(post),
		});
		const result = (await call(duplicateHandler, {
			params: { id: "p1" },
			controller: ctrl,
		})) as { post: BlogPost };
		expect(result.post.title).toBe("Hello World (copy)");
	});
});

describe("admin POST /blog/posts/bulk-update", () => {
	it("bulk updates post statuses", async () => {
		const ctrl = makeController({
			bulkUpdateStatus: vi.fn().mockResolvedValue({ updated: 3, failed: [] }),
		});
		const result = (await call(bulkUpdateHandler, {
			body: { ids: ["p1", "p2", "p3"], status: "published" },
			controller: ctrl,
		})) as { updated: number; failed: string[] };
		expect(result.updated).toBe(3);
	});
});

describe("admin POST /blog/posts/bulk-delete", () => {
	it("bulk deletes posts", async () => {
		const ctrl = makeController({
			bulkDelete: vi.fn().mockResolvedValue({ deleted: 2, failed: [] }),
		});
		const result = (await call(bulkDeleteHandler, {
			body: { ids: ["p1", "p2"] },
			controller: ctrl,
		})) as { deleted: number; failed: string[] };
		expect(result.deleted).toBe(2);
	});
});

describe("admin POST /blog/posts/check-scheduled", () => {
	it("returns published scheduled posts", async () => {
		const posts = [makePost({ status: "published" })];
		const ctrl = makeController({
			checkScheduledPosts: vi.fn().mockResolvedValue(posts),
		});
		const result = (await call(checkScheduledHandler, {
			controller: ctrl,
		})) as { published: BlogPost[] };
		expect(result.published).toHaveLength(1);
	});
});

describe("admin GET /blog/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as { stats: PostStats };
		expect(result.stats.total).toBe(0);
	});

	it("returns real stats", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				total: 30,
				draft: 5,
				published: 20,
				scheduled: 3,
				archived: 2,
				totalViews: 12500,
				categories: [{ category: "News", count: 15 }],
				tags: [{ tag: "product", count: 10 }],
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: PostStats;
		};
		expect(result.stats.total).toBe(30);
		expect(result.stats.totalViews).toBe(12500);
	});
});
