import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ProductFeedsController } from "../../service";

const fieldMappingSchema = z.object({
	sourceField: z.string().min(1),
	targetField: z.string().min(1),
	transform: z.string().optional(),
	transformValue: z.string().optional(),
	defaultValue: z.string().optional(),
});

const filtersSchema = z.object({
	includeStatuses: z.array(z.string()).optional(),
	excludeCategories: z.array(z.string()).optional(),
	includeCategories: z.array(z.string()).optional(),
	minPrice: z.number().optional(),
	maxPrice: z.number().optional(),
	requireImages: z.boolean().optional(),
	requireInStock: z.boolean().optional(),
});

export const createFeed = createAdminEndpoint(
	"/admin/product-feeds/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200),
			slug: z
				.string()
				.min(1)
				.max(100)
				.regex(/^[a-z0-9-]+$/),
			channel: z.enum([
				"google-shopping",
				"facebook",
				"microsoft",
				"pinterest",
				"tiktok",
				"custom",
			]),
			format: z.enum(["xml", "csv", "tsv", "json"]).optional(),
			country: z.string().max(2).optional(),
			currency: z.string().max(3).optional(),
			language: z.string().max(5).optional(),
			fieldMappings: z.array(fieldMappingSchema).optional(),
			filters: filtersSchema.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.productFeeds as ProductFeedsController;

		const feed = await controller.createFeed({
			name: ctx.body.name,
			slug: ctx.body.slug,
			channel: ctx.body.channel,
			format: ctx.body.format,
			country: ctx.body.country,
			currency: ctx.body.currency,
			language: ctx.body.language,
			fieldMappings: ctx.body.fieldMappings,
			filters: ctx.body.filters,
		});

		return { feed };
	},
);
