import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BrandController } from "../../service";

export const unassignProducts = createAdminEndpoint(
	"/admin/brands/:id/products/unassign",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
			productIds: z.array(z.string().min(1)).min(1).max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;

		const brand = await controller.getBrand(ctx.params.id);
		if (!brand) {
			return { error: "Brand not found", status: 404 };
		}

		const removed = await controller.bulkUnassignProducts({
			brandId: ctx.params.id,
			productIds: ctx.body.productIds,
		});

		return { removed };
	},
);
