import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BrandController } from "../../service";

export const getProductBrand = createStoreEndpoint(
	"/brands/product/:productId",
	{
		method: "GET",
		params: z.object({
			productId: z.string().min(1).max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;
		const brand = await controller.getBrandForProduct(ctx.params.productId);
		return { brand: brand ?? null };
	},
);
