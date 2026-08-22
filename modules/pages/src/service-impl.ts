import type { ModuleDataService } from "@86d-app/core/types/module";
import type { Page, PagesController } from "./service";

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

export function createPagesController(
	data: ModuleDataService,
): PagesController {
	return {
		async createPage(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const status = params.status ?? "draft";

			const page: Page = {
				id,
				title: params.title,
				slug: params.slug?.trim() ? params.slug.trim() : slugify(params.title),
				content: params.content,
				excerpt: params.excerpt,
				status,
				template: params.template,
				metaTitle: params.metaTitle,
				metaDescription: params.metaDescription,
				featuredImage: params.featuredImage,
				position: params.position ?? 0,
				showInNavigation: params.showInNavigation ?? false,
				parentId: params.parentId,
				publishedAt: status === "published" ? now : undefined,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("page", id, page as Record<string, unknown>);
			return page;
		},

		async updatePage(id, params) {
			const existing = await data.get("page", id);
			if (!existing) return null;

			const page = existing as unknown as Page;
			const now = new Date();

			const updated: Page = {
				...page,
				...(params.title !== undefined ? { title: params.title } : {}),
				...(params.slug !== undefined ? { slug: params.slug } : {}),
				...(params.content !== undefined ? { content: params.content } : {}),
				...(params.excerpt !== undefined ? { excerpt: params.excerpt } : {}),
				...(params.status !== undefined ? { status: params.status } : {}),
				...(params.template !== undefined ? { template: params.template } : {}),
				...(params.metaTitle !== undefined
					? { metaTitle: params.metaTitle }
					: {}),
				...(params.metaDescription !== undefined
					? { metaDescription: params.metaDescription }
					: {}),
				...(params.featuredImage !== undefined
					? { featuredImage: params.featuredImage }
					: {}),
				...(params.position !== undefined ? { position: params.position } : {}),
				...(params.showInNavigation !== undefined
					? { showInNavigation: params.showInNavigation }
					: {}),
				...(params.parentId !== undefined ? { parentId: params.parentId } : {}),
				updatedAt: now,
			};

			if (
				params.status === "published" &&
				page.status !== "published" &&
				!updated.publishedAt
			) {
				updated.publishedAt = now;
			}

			await data.upsert("page", id, updated as Record<string, unknown>);
			return updated;
		},

		async deletePage(id) {
			const existing = await data.get("page", id);
			if (!existing) return false;
			await data.delete("page", id);
			return true;
		},

		async getPage(id) {
			const raw = await data.get("page", id);
			if (!raw) return null;
			return raw as unknown as Page;
		},

		async getPageBySlug(slug) {
			const matches = await data.findMany("page", {
				where: { slug },
				take: 1,
			});
			return matches[0] as unknown as Page;
		},

		async publishPage(id) {
			const existing = await data.get("page", id);
			if (!existing) return null;

			const page = existing as unknown as Page;
			const now = new Date();
			const updated: Page = {
				...page,
				status: "published",
				publishedAt: page.publishedAt ?? now,
				updatedAt: now,
			};
			await data.upsert("page", id, updated as Record<string, unknown>);
			return updated;
		},

		async unpublishPage(id) {
			const existing = await data.get("page", id);
			if (!existing) return null;

			const page = existing as unknown as Page;
			const now = new Date();
			const updated: Page = {
				...page,
				status: "draft",
				updatedAt: now,
			};
			await data.upsert("page", id, updated as Record<string, unknown>);
			return updated;
		},

		async archivePage(id) {
			const existing = await data.get("page", id);
			if (!existing) return null;

			const page = existing as unknown as Page;
			const now = new Date();
			const updated: Page = {
				...page,
				status: "archived",
				updatedAt: now,
			};
			await data.upsert("page", id, updated as Record<string, unknown>);
			return updated;
		},

		async listPages(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.showInNavigation !== undefined)
				where.showInNavigation = params.showInNavigation;
			if (params?.parentId !== undefined) where.parentId = params.parentId;

			const all = await data.findMany("page", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
				orderBy: { position: "asc" },
			});
			return all as unknown as Page[];
		},

		async getNavigationPages() {
			const pages = await data.findMany("page", {
				where: { status: "published", showInNavigation: true },
				orderBy: { position: "asc" },
			});
			return pages as unknown as Page[];
		},
	};
}
