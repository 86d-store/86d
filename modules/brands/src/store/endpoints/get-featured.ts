import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BrandController } from "../../service";

export const getFeatured = createStoreEndpoint(
	"/brands/featured",
	{
		method: "GET",
		query: z.object({
			limit: z.coerce.number().int().min(1).max(50).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;
		const brands = await controller.getFeaturedBrands(ctx.query.limit ?? 10);
		return { brands };
	},
);
