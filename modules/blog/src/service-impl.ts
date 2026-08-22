import { stripTags } from "@86d-app/core/sanitize";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type { BlogController, BlogPost, PostStats } from "./service";

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/** Estimate reading time in minutes based on word count (~200 wpm). */
function estimateReadingTime(content: string): number {
	const words = stripTags(content)
		.replace(/[#*_~`>\-|[\]()!]/g, "")
		.split(/\s+/)
		.filter((w) => w.length > 0);
	return Math.max(1, Math.ceil(words.length / 200));
}

export function createBlogController(data: ModuleDataService): BlogController {
	return {
		async createPost(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const status = params.status ?? "draft";

			const post: BlogPost = {
				id,
				title: params.title,
				slug: params.slug || slugify(params.title),
				content: params.content,
				excerpt: params.excerpt,
				coverImage: params.coverImage,
				author: params.author,
				status:
					status === "scheduled" && !params.scheduledAt ? "draft" : status,
				tags: params.tags ?? [],
				category: params.category,
				featured: params.featured ?? false,
				readingTime: estimateReadingTime(params.content),
				metaTitle: params.metaTitle,
				metaDescription: params.metaDescription,
				scheduledAt:
					status === "scheduled" && params.scheduledAt
						? params.scheduledAt
						: undefined,
				publishedAt: status === "published" ? now : undefined,
				views: 0,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("post", id, post as Record<string, unknown>);
			return post;
		},

		async updatePost(id, params) {
			const existing = await data.get("post", id);
			if (!existing) return null;

			const post = existing as unknown as BlogPost;
			const now = new Date();

			const updated: BlogPost = {
				...post,
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.slug !== undefined ? { slug: params.slug } : {}),
				...(params.content !== undefined
					? {
							content: params.content,
							readingTime: estimateReadingTime(params.content),
						}
					: {}),
				...(params.excerpt !== undefined ? { excerpt: params.excerpt } : {}),
				...(params.coverImage !== undefined
					? { coverImage: params.coverImage }
					: {}),
				...(params.author !== undefined ? { author: params.author } : {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.tags !== undefined ? { tags: params.tags } : {}),
				...(params.category !== undefined ? { category: params.category } : {}),
				...(params.featured !== undefined ? { featured: params.featured } : {}),
				...(params.metaTitle !== undefined
					? { metaTitle: params.metaTitle }
					: {}),
				...(params.metaDescription !== undefined
					? { metaDescription: params.metaDescription }
					: {}),
				...(params.scheduledAt !== undefined
					? { scheduledAt: params.scheduledAt }
					: {}),
				updatedAt: now,
			};

			// If transitioning to published and not previously published, set publishedAt
			if (
				params.status === "published" &&
				post.status !== "published" &&
				!updated.publishedAt
			) {
				updated.publishedAt = now;
			}

			// If scheduling, validate scheduledAt is present
			if (params.status === "scheduled" && !updated.scheduledAt) {
				updated.status = post.status;
			}

			await data.upsert("post", id, updated as Record<string, unknown>);
			return updated;
		},

		async deletePost(id) {
			const existing = await data.get("post", id);
			if (!existing) return false;
			await data.delete("post", id);
			return true;
		},

		async getPost(id) {
			const raw = await data.get("post", id);
			if (!raw) return null;
			return raw as unknown as BlogPost;
		},

		async getPostBySlug(slug) {
			const matches = await data.findMany("post", {
				where: { slug },
				take: 1,
			});
			return (matches[0] as unknown as BlogPost | undefined) ?? null;
		},

		async publishPost(id) {
			const existing = await data.get("post", id);
			if (!existing) return null;

			const post = existing as unknown as BlogPost;
			const now = new Date();
			const updated: BlogPost = {
				...post,
				status: "published",
				publishedAt: post.publishedAt ?? now,
				scheduledAt: undefined,
				updatedAt: now,
			};
			await data.upsert("post", id, updated as Record<string, unknown>);
			return updated;
		},

		async unpublishPost(id) {
			const existing = await data.get("post", id);
			if (!existing) return null;

			const post = existing as unknown as BlogPost;
			const now = new Date();
			const updated: BlogPost = {
				...post,
				status: "draft",
				updatedAt: now,
			};
			await data.upsert("post", id, updated as Record<string, unknown>);
			return updated;
		},

		async archivePost(id) {
			const existing = await data.get("post", id);
			if (!existing) return null;

			const post = existing as unknown as BlogPost;
			const now = new Date();
			const updated: BlogPost = {
				...post,
				status: "archived",
				updatedAt: now,
			};
			await data.upsert("post", id, updated as Record<string, unknown>);
			return updated;
		},

		async duplicatePost(id) {
			const existing = await data.get("post", id);
			if (!existing) return null;

			const post = existing as unknown as BlogPost;
			const now = new Date();
			const newId = crypto.randomUUID();
			const duplicate: BlogPost = {
				...post,
				id: newId,
				title: `${post.title} (Copy)`,
				slug: `${post.slug}-copy-${newId.slice(0, 8)}`,
				status: "draft",
				featured: false,
				publishedAt: undefined,
				scheduledAt: undefined,
				views: 0,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("post", newId, duplicate as Record<string, unknown>);
			return duplicate;
		},

		async incrementViews(id) {
			const existing = await data.get("post", id);
			if (!existing) return null;

			const post = existing as unknown as BlogPost;
			const updated: BlogPost = {
				...post,
				views: post.views + 1,
			};
			await data.upsert("post", id, updated as Record<string, unknown>);
			return updated;
		},

		async listPosts(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.category) where.category = params.category;
			if (params?.featured !== undefined) where.featured = params.featured;

			const all = await data.findMany("post", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { createdAt: "desc" },
			});
			let posts = all as unknown as BlogPost[];

			// Tag filtering must remain client-side (array contains)
			if (params?.tag) {
				const tag = params.tag;
				posts = posts.filter((p) => (p.tags as string[]).includes(tag));
			}

			// Search filtering (title, content, excerpt)
			if (params?.search) {
				const term = params.search.toLowerCase();
				posts = posts.filter(
					(p) =>
						p.title.toLowerCase().includes(term) ||
						p.content.toLowerCase().includes(term) ||
						(p.excerpt?.toLowerCase().includes(term) ?? false),
				);
			}

			return posts;
		},

		async getRelatedPosts(id, limit = 5) {
			const existing = await data.get("post", id);
			if (!existing) return [];

			const post = existing as unknown as BlogPost;
			const allPublished = await data.findMany("post", {
				where: { status: "published" },
			});
			const published = allPublished as unknown as BlogPost[];

			// Score by shared tags and same category
			const scored = published
				.filter((p) => p.id !== id)
				.map((p) => {
					let score = 0;
					if (p.tags) {
						for (const tag of p.tags) {
							if ((post.tags as string[]).includes(tag)) score += 2;
						}
					}
					if (post.category && p.category === post.category) score += 1;
					return { post: p, score };
				})
				.filter((item) => item.score > 0)
				.sort((a, b) => b.score - a.score)
				.slice(0, limit);

			return scored.map((item) => item.post);
		},

		async getStats() {
			const all = await data.findMany("post", {});
			const posts = all as unknown as BlogPost[];

			const stats: PostStats = {
				total: posts.length,
				draft: 0,
				published: 0,
				scheduled: 0,
				archived: 0,
				totalViews: 0,
				categories: [],
				tags: [],
			};

			const categoryMap = new Map<string, number>();
			const tagMap = new Map<string, number>();

			for (const post of posts) {
				switch (post.status) {
					case "draft":
						stats.draft++;
						break;
					case "published":
						stats.published++;
						break;
					case "scheduled":
						stats.scheduled++;
						break;
					case "archived":
						stats.archived++;
						break;
				}
				stats.totalViews += post.views;

				if (post.category) {
					categoryMap.set(
						post.category,
						(categoryMap.get(post.category) ?? 0) + 1,
					);
				}
				for (const tag of post.tags) {
					tagMap.set(tag, (tagMap.get(tag) ?? 0) + 1);
				}
			}

			stats.categories = [...categoryMap.entries()]
				.map(([category, count]) => ({ category, count }))
				.sort((a, b) => b.count - a.count);

			stats.tags = [...tagMap.entries()]
				.map(([tag, count]) => ({ tag, count }))
				.sort((a, b) => b.count - a.count);

			return stats;
		},

		async checkScheduledPosts() {
			const all = await data.findMany("post", {
				where: { status: "scheduled" },
			});
			const scheduled = all as unknown as BlogPost[];
			const now = new Date();
			const published: BlogPost[] = [];

			for (const post of scheduled) {
				if (post.scheduledAt && new Date(post.scheduledAt) <= now) {
					const updated: BlogPost = {
						...post,
						status: "published",
						publishedAt: new Date(post.scheduledAt),
						scheduledAt: undefined,
						updatedAt: now,
					};
					await data.upsert(
						"post",
						post.id,
						updated as Record<string, unknown>,
					);
					published.push(updated);
				}
			}

			return published;
		},

		async bulkUpdateStatus(ids, status) {
			let updated = 0;
			const failed: string[] = [];

			for (const id of ids) {
				const existing = await data.get("post", id);
				if (!existing) {
					failed.push(id);
					continue;
				}

				const post = existing as unknown as BlogPost;
				const now = new Date();
				const patched: BlogPost = {
					...post,
					status,
					updatedAt: now,
				};

				if (
					status === "published" &&
					post.status !== "published" &&
					!patched.publishedAt
				) {
					patched.publishedAt = now;
				}

				await data.upsert("post", id, patched as Record<string, unknown>);
				updated++;
			}

			return { updated, failed };
		},

		async bulkDelete(ids) {
			let deleted = 0;
			const failed: string[] = [];

			for (const id of ids) {
				const existing = await data.get("post", id);
				if (!existing) {
					failed.push(id);
					continue;
				}
				await data.delete("post", id);
				deleted++;
			}

			return { deleted, failed };
		},
	};
}
