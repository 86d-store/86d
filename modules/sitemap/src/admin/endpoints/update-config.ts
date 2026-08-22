import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { SitemapController } from "../../service";

const changeFreqValues = [
	"always",
	"hourly",
	"daily",
	"weekly",
	"monthly",
	"yearly",
	"never",
] as const;

export const updateConfig = createAdminEndpoint(
	"/admin/sitemap/config/update",
	{
		method: "POST",
		body: z.object({
			baseUrl: z.string().url().max(2000).optional(),
			includeProducts: z.boolean().optional(),
			includeCollections: z.boolean().optional(),
			includePages: z.boolean().optional(),
			includeBlog: z.boolean().optional(),
			includeBrands: z.boolean().optional(),
			defaultChangeFreq: z.enum(changeFreqValues).optional(),
			defaultPriority: z.number().min(0).max(1).optional(),
			productChangeFreq: z.enum(changeFreqValues).optional(),
			productPriority: z.number().min(0).max(1).optional(),
			collectionChangeFreq: z.enum(changeFreqValues).optional(),
			collectionPriority: z.number().min(0).max(1).optional(),
			pageChangeFreq: z.enum(changeFreqValues).optional(),
			pagePriority: z.number().min(0).max(1).optional(),
			blogChangeFreq: z.enum(changeFreqValues).optional(),
			blogPriority: z.number().min(0).max(1).optional(),
			excludedPaths: z.array(z.string().max(500)).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.sitemap as SitemapController;

		const updateParams: Parameters<typeof controller.updateConfig>[0] = {};
		if (ctx.body.baseUrl != null) updateParams.baseUrl = ctx.body.baseUrl;
		if (ctx.body.includeProducts != null)
			updateParams.includeProducts = ctx.body.includeProducts;
		if (ctx.body.includeCollections != null)
			updateParams.includeCollections = ctx.body.includeCollections;
		if (ctx.body.includePages != null)
			updateParams.includePages = ctx.body.includePages;
		if (ctx.body.includeBlog != null)
			updateParams.includeBlog = ctx.body.includeBlog;
		if (ctx.body.includeBrands != null)
			updateParams.includeBrands = ctx.body.includeBrands;
		if (ctx.body.defaultChangeFreq != null)
			updateParams.defaultChangeFreq = ctx.body.defaultChangeFreq;
		if (ctx.body.defaultPriority != null)
			updateParams.defaultPriority = ctx.body.defaultPriority;
		if (ctx.body.productChangeFreq != null)
			updateParams.productChangeFreq = ctx.body.productChangeFreq;
		if (ctx.body.productPriority != null)
			updateParams.productPriority = ctx.body.productPriority;
		if (ctx.body.collectionChangeFreq != null)
			updateParams.collectionChangeFreq = ctx.body.collectionChangeFreq;
		if (ctx.body.collectionPriority != null)
			updateParams.collectionPriority = ctx.body.collectionPriority;
		if (ctx.body.pageChangeFreq != null)
			updateParams.pageChangeFreq = ctx.body.pageChangeFreq;
		if (ctx.body.pagePriority != null)
			updateParams.pagePriority = ctx.body.pagePriority;
		if (ctx.body.blogChangeFreq != null)
			updateParams.blogChangeFreq = ctx.body.blogChangeFreq;
		if (ctx.body.blogPriority != null)
			updateParams.blogPriority = ctx.body.blogPriority;
		if (ctx.body.excludedPaths != null)
			updateParams.excludedPaths = ctx.body.excludedPaths;

		const config = await controller.updateConfig(updateParams);

		return { config };
	},
);
