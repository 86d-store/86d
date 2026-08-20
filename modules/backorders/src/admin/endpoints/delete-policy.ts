import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BackordersController } from "../../service";

export const deletePolicy = createAdminEndpoint(
	"/admin/backorders/policies/:productId/delete",
	{
		method: "POST",
		params: z.object({ productId: z.string().max(200) }),
		body: z.object({}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const deleted = await controller.deletePolicy(ctx.params.productId);
		return { deleted };
	},
);
