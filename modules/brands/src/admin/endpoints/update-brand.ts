import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { BrandController } from "../../service";

export const updateBrand = createAdminEndpoint(
	"/admin/brands/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().min(1).max(200).optional(),
			description: z
				.string()
				.max(5000)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			logo: z.string().max(2000).nullable().optional(),
			bannerImage: z.string().max(2000).nullable().optional(),
			website: z.string().url().max(2000).nullable().optional(),
			isActive: z.boolean().optional(),
			isFeatured: z.boolean().optional(),
			position: z.number().int().min(0).max(10000).optional(),
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
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;

		if (ctx.body.slug != null) {
			const existing = await controller.getBrandBySlug(ctx.body.slug);
			if (existing && existing.id !== ctx.params.id) {
				return {
					error: "A brand with this slug already exists",
					status: 400,
				};
			}
		}

		const params: Parameters<typeof controller.updateBrand>[1] = {};
		if (ctx.body.name != null) params.name = ctx.body.name;
		if (ctx.body.slug != null) params.slug = ctx.body.slug;
		if (ctx.body.isActive != null) params.isActive = ctx.body.isActive;
		if (ctx.body.isFeatured != null) params.isFeatured = ctx.body.isFeatured;
		if (ctx.body.position != null) params.position = ctx.body.position;

		// Nullable fields: null clears, undefined omits
		if (ctx.body.description !== undefined)
			params.description = ctx.body.description;
		if (ctx.body.logo !== undefined) params.logo = ctx.body.logo;
		if (ctx.body.bannerImage !== undefined)
			params.bannerImage = ctx.body.bannerImage;
		if (ctx.body.website !== undefined) params.website = ctx.body.website;
		if (ctx.body.seoTitle !== undefined) params.seoTitle = ctx.body.seoTitle;
		if (ctx.body.seoDescription !== undefined)
			params.seoDescription = ctx.body.seoDescription;

		const brand = await controller.updateBrand(ctx.params.id, params);

		if (!brand) {
			return { error: "Brand not found", status: 404 };
		}

		return { brand };
	},
);
