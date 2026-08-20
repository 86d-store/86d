import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BrandController } from "../../service";

export const getBrandProducts = createAdminEndpoint(
	"/admin/brands/:id/products",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;

		const brand = await controller.getBrand(ctx.params.id);
		if (!brand) {
			return { error: "Brand not found", status: 404 };
		}

		const products = await controller.getBrandProducts({
			brandId: ctx.params.id,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		const total = await controller.countBrandProducts(ctx.params.id);

		return { products, total };
	},
);
