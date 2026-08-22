import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WalmartController } from "../../service";

export const retireItemEndpoint = createAdminEndpoint(
	"/admin/walmart/items/:id/retire",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const item = await controller.retireItem(ctx.params.id);
		return { item };
	},
);
