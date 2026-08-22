import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BrandController } from "../../service";

export const getBrand = createAdminEndpoint(
	"/admin/brands/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;
		const brand = await controller.getBrand(ctx.params.id);

		if (!brand) {
			return { error: "Brand not found", status: 404 };
		}

		const productCount = await controller.countBrandProducts(brand.id);

		return { brand, productCount };
	},
);
