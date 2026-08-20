import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BrandController } from "../../service";

export const getBrand = createStoreEndpoint(
	"/brands/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;
		const brand = await controller.getBrandBySlug(ctx.params.slug);

		if (!brand?.isActive) {
			return { error: "Brand not found", status: 404 };
		}

		return { brand };
	},
);
