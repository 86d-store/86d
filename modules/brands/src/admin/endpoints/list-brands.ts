import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BrandController } from "../../service";

export const listBrands = createAdminEndpoint(
	"/admin/brands",
	{
		method: "GET",
		query: z.object({
			active: z.enum(["true", "false"]).optional(),
			featured: z.enum(["true", "false"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;

		const params: Parameters<typeof controller.listBrands>[0] = {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.active === "true") params.isActive = true;
		else if (ctx.query.active === "false") params.isActive = false;
		if (ctx.query.featured === "true") params.isFeatured = true;
		else if (ctx.query.featured === "false") params.isFeatured = false;

		const brands = await controller.listBrands(params);

		const countParams: Parameters<typeof controller.countBrands>[0] = {};
		if (params.isActive != null) countParams.isActive = params.isActive;
		if (params.isFeatured != null) countParams.isFeatured = params.isFeatured;
		const total = await controller.countBrands(countParams);

		return { brands, total };
	},
);
