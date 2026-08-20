import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PreordersController } from "../../service";

export const markReady = createAdminEndpoint(
	"/admin/preorders/items/:id/ready",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const item = await controller.markReady(ctx.params.id);
		if (!item) {
			return { error: "Cannot mark as ready", item: null };
		}
		return { item };
	},
);
