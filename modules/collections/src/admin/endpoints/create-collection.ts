import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
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

export const createCollection = createAdminEndpoint(
	"/admin/collections/create",
	{
		method: "POST",
		body: z.object({
			title: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			image: z.string().max(2000).optional(),
			type: z.enum(["manual", "automatic"]),
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
				.optional(),
			seoTitle: z.string().max(200).transform(sanitizeText).optional(),
			seoDescription: z.string().max(500).transform(sanitizeText).optional(),
			publishedAt: z.coerce.date().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.collections as CollectionController;

		const existing = await controller.getCollectionBySlug(ctx.body.slug);
		if (existing) {
			return {
				error: "A collection with this slug already exists",
				status: 400,
			};
		}

		if (ctx.body.type === "automatic" && !ctx.body.conditions) {
			return {
				error: "Automatic collections require at least one condition",
				status: 400,
			};
		}

		const params: Parameters<typeof controller.createCollection>[0] = {
			title: ctx.body.title,
			slug: ctx.body.slug,
			type: ctx.body.type as CollectionType,
		};
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.image != null) params.image = ctx.body.image;
		if (ctx.body.sortOrder != null)
			params.sortOrder = ctx.body.sortOrder as CollectionSortOrder;
		if (ctx.body.isActive != null) params.isActive = ctx.body.isActive;
		if (ctx.body.isFeatured != null) params.isFeatured = ctx.body.isFeatured;
		if (ctx.body.position != null) params.position = ctx.body.position;
		if (ctx.body.conditions != null)
			params.conditions = ctx.body.conditions as CollectionConditions;
		if (ctx.body.seoTitle != null) params.seoTitle = ctx.body.seoTitle;
		if (ctx.body.seoDescription != null)
			params.seoDescription = ctx.body.seoDescription;
		if (ctx.body.publishedAt != null) params.publishedAt = ctx.body.publishedAt;

		const collection = await controller.createCollection(params);

		return { collection };
	},
);
