import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WalmartController } from "../../service";

export const getItemEndpoint = createAdminEndpoint(
	"/admin/walmart/items/:id",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.walmart as WalmartController;
		const item = await controller.getItem(ctx.params.id);
		return { item };
	},
);
