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

export const updateFeed = createAdminEndpoint(
	"/admin/product-feeds/:id/update",
	{
		method: "POST",
		params: z.object({ id: z.string().max(128) }),
		body: z.object({
			name: z.string().min(1).max(200).optional(),
			slug: z
				.string()
				.min(1)
				.max(100)
				.regex(/^[a-z0-9-]+$/)
				.optional(),
			channel: z
				.enum([
					"google-shopping",
					"facebook",
					"microsoft",
					"pinterest",
					"tiktok",
					"custom",
				])
				.optional(),
			format: z.enum(["xml", "csv", "tsv", "json"]).optional(),
			status: z.enum(["active", "paused", "error", "draft"]).optional(),
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

		const feed = await controller.updateFeed(ctx.params.id, {
			name: ctx.body.name,
			slug: ctx.body.slug,
			channel: ctx.body.channel,
			format: ctx.body.format,
			status: ctx.body.status,
			country: ctx.body.country,
			currency: ctx.body.currency,
			language: ctx.body.language,
			fieldMappings: ctx.body.fieldMappings,
			filters: ctx.body.filters,
		});

		if (!feed) {
			return { error: "Feed not found" };
		}

		return { feed };
	},
);
