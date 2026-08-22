import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type {
	CollectionConditions,
	CollectionController,
	CollectionSortOrder,
	CollectionType,
} from "../../service";

const conditionSchema = z.object({
	field: z.string().min(1).max(100),
	operator: z.enum([
		"equals",
		"not_equals",
		"contains",
		"starts_with",
		"ends_with",
		"greater_than",
		"less_than",
		"in",
		"not_in",
	]),
	value: z.union([
		z.string().max(500),
		z.number(),
		z.array(z.string().max(500)),
	]),
});

export const updateCollection = createAdminEndpoint(
	"/admin/collections/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			title: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().min(1).max(200).optional(),
			description: z
				.string()
				.max(5000)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			image: z.string().max(2000).nullable().optional(),
			type: z.enum(["manual", "automatic"]).optional(),
			sortOrder: z
				.enum([
					"manual",
					"title-asc",
					"title-desc",
					"price-asc",
					"price-desc",
					"created-asc",
					"created-desc",
					"best-selling",
				])
				.optional(),
			isActive: z.boolean().optional(),
			isFeatured: z.boolean().optional(),
			position: z.number().int().min(0).max(10000).optional(),
			conditions: z
				.object({
					match: z.enum(["all", "any"]),
					rules: z.array(conditionSchema).min(1).max(50),
				})
				.nullable()
				.optional(),
			seoTitle: z
				.string()
				.max(200)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			seoDescription: z
				.string()
				.max(500)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			publishedAt: z.coerce.date().nullable().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		if (ctx.body.slug) {
			const bySlug = await controller.getCollectionBySlug(ctx.body.slug);
			if (bySlug && bySlug.id !== ctx.params.id) {
				return {
					error: "A collection with this slug already exists",
					status: 400,
				};
			}
		}

		const params: Parameters<typeof controller.updateCollection>[1] = {};
		if (ctx.body.title != null) params.title = ctx.body.title;
		if (ctx.body.slug != null) params.slug = ctx.body.slug;
		if (ctx.body.type != null) params.type = ctx.body.type as CollectionType;
		if (ctx.body.sortOrder != null)
			params.sortOrder = ctx.body.sortOrder as CollectionSortOrder;
		if (ctx.body.isActive != null) params.isActive = ctx.body.isActive;
		if (ctx.body.isFeatured != null) params.isFeatured = ctx.body.isFeatured;
		if (ctx.body.position != null) params.position = ctx.body.position;

		// Nullable fields: null clears, undefined omits
		if (ctx.body.description !== undefined)
			params.description = ctx.body.description;
		if (ctx.body.image !== undefined) params.image = ctx.body.image;
		if (ctx.body.conditions !== undefined)
			params.conditions = ctx.body.conditions as CollectionConditions | null;
		if (ctx.body.seoTitle !== undefined) params.seoTitle = ctx.body.seoTitle;
		if (ctx.body.seoDescription !== undefined)
			params.seoDescription = ctx.body.seoDescription;
		if (ctx.body.publishedAt !== undefined)
			params.publishedAt = ctx.body.publishedAt;

		const collection = await controller.updateCollection(ctx.params.id, params);

		if (!collection) {
			return { error: "Collection not found", status: 404 };
		}

		return { collection };
	},
);
