import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BrandController } from "../../service";

export const deleteBrand = createAdminEndpoint(
	"/admin/brands/:id/delete",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.brands as BrandController;
		const deleted = await controller.deleteBrand(ctx.params.id);

		if (!deleted) {
			return { error: "Brand not found", status: 404 };
		}

		return { success: true };
	},
);
