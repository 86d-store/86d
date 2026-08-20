import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BrandController } from "../../service";

export const listBrands = createStoreEndpoint(
	"/brands",
	{
		method: "GET",
		query: z.object({
			featured: z.enum(["true", "false"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;

		const params: Parameters<typeof controller.listBrands>[0] = {
			isActive: true,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.featured === "true") params.isFeatured = true;
		else if (ctx.query.featured === "false") params.isFeatured = false;

		const brands = await controller.listBrands(params);

		return { brands };
	},
);
