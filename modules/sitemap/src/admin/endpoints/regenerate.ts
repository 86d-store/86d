import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SitemapController } from "../../service";

export const regenerateSitemap = createAdminEndpoint(
	"/admin/sitemap/regenerate",
	{
		method: "POST",
		body: z.object({
			products: z
				.array(
					z.object({
						slug: z.string(),
						updatedAt: z.coerce.date().optional(),
					}),
				)
				.optional(),
			collections: z
				.array(
					z.object({
						slug: z.string(),
						updatedAt: z.coerce.date().optional(),
					}),
				)
				.optional(),
			pages: z
				.array(
					z.object({
						slug: z.string(),
						updatedAt: z.coerce.date().optional(),
					}),
				)
				.optional(),
			blog: z
				.array(
					z.object({
						slug: z.string(),
						updatedAt: z.coerce.date().optional(),
					}),
				)
				.optional(),
			brands: z
				.array(
					z.object({
						slug: z.string(),
						updatedAt: z.coerce.date().optional(),
					}),
				)
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;

		// Build params to avoid passing undefined for optional updatedAt
		const pages: Parameters<typeof controller.regenerate>[0] = {};
		if (ctx.body.products != null) {
			pages.products = ctx.body.products.map((p) => {
				const item: { slug: string; updatedAt?: Date } = { slug: p.slug };
				if (p.updatedAt != null) item.updatedAt = p.updatedAt;
				return item;
			});
		}
		if (ctx.body.collections != null) {
			pages.collections = ctx.body.collections.map((c) => {
				const item: { slug: string; updatedAt?: Date } = { slug: c.slug };
				if (c.updatedAt != null) item.updatedAt = c.updatedAt;
				return item;
			});
		}
		if (ctx.body.pages != null) {
			pages.pages = ctx.body.pages.map((p) => {
				const item: { slug: string; updatedAt?: Date } = { slug: p.slug };
				if (p.updatedAt != null) item.updatedAt = p.updatedAt;
				return item;
			});
		}
		if (ctx.body.blog != null) {
			pages.blog = ctx.body.blog.map((b) => {
				const item: { slug: string; updatedAt?: Date } = { slug: b.slug };
				if (b.updatedAt != null) item.updatedAt = b.updatedAt;
				return item;
			});
		}
		if (ctx.body.brands != null) {
			pages.brands = ctx.body.brands.map((b) => {
				const item: { slug: string; updatedAt?: Date } = { slug: b.slug };
				if (b.updatedAt != null) item.updatedAt = b.updatedAt;
				return item;
			});
		}

		const count = await controller.regenerate(pages);

		return { entriesGenerated: count };
	},
);
