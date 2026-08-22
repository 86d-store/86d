import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BrandController } from "../../service";

export const getBrandProducts = createStoreEndpoint(
	"/brands/:slug/products",
	{
		method: "GET",
		params: z.object({
			slug: z.string().min(1).max(200),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;
		const brand = await controller.getBrandBySlug(ctx.params.slug);

		if (!brand?.isActive) {
			return { error: "Brand not found", status: 404 };
		}

		const products = await controller.getBrandProducts({
			brandId: brand.id,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});

		return { brand, products };
	},
);
