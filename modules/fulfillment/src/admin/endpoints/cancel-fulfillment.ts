import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FulfillmentController } from "../../service";

export const cancelFulfillment = createAdminEndpoint(
	"/admin/fulfillment/:id/cancel",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.fulfillment as FulfillmentController;
		const fulfillment = await controller.cancelFulfillment(ctx.params.id);
		if (!fulfillment) {
			return { error: "Fulfillment not found", status: 404 };
		}
		return { fulfillment };
	},
);
