import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PreordersController } from "../../service";

export const notifyCustomers = createAdminEndpoint(
	"/admin/preorders/campaigns/:id/notify",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const result = await controller.notifyCustomers(ctx.params.id);
		return result;
	},
);
