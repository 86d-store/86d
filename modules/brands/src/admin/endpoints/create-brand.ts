import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { BrandController } from "../../service";

export const createBrand = createAdminEndpoint(
	"/admin/brands/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			logo: z.string().max(2000).optional(),
			bannerImage: z.string().max(2000).optional(),
			website: z.string().url().max(2000).optional(),
			isActive: z.boolean().optional(),
			isFeatured: z.boolean().optional(),
			position: z.number().int().min(0).max(10000).optional(),
			seoTitle: z.string().max(200).transform(sanitizeText).optional(),
			seoDescription: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;

		const existing = await controller.getBrandBySlug(ctx.body.slug);
		if (existing) {
			return {
				error: "A brand with this slug already exists",
				status: 400,
			};
		}

		const params: Parameters<typeof controller.createBrand>[0] = {
			name: ctx.body.name,
			slug: ctx.body.slug,
		};
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.logo != null) params.logo = ctx.body.logo;
		if (ctx.body.bannerImage != null) params.bannerImage = ctx.body.bannerImage;
		if (ctx.body.website != null) params.website = ctx.body.website;
		if (ctx.body.isActive != null) params.isActive = ctx.body.isActive;
		if (ctx.body.isFeatured != null) params.isFeatured = ctx.body.isFeatured;
		if (ctx.body.position != null) params.position = ctx.body.position;
		if (ctx.body.seoTitle != null) params.seoTitle = ctx.body.seoTitle;
		if (ctx.body.seoDescription != null)
			params.seoDescription = ctx.body.seoDescription;

		const brand = await controller.createBrand(params);

		return { brand };
	},
);
