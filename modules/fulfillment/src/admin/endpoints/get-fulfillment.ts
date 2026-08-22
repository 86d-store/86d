import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { FulfillmentController } from "../../service";

export const getFulfillment = createAdminEndpoint(
	"/admin/fulfillment/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().min(1) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.fulfillment as FulfillmentController;
		const fulfillment = await controller.getFulfillment(ctx.params.id);
		if (!fulfillment) {
			return { error: "Fulfillment not found", status: 404 };
		}
		return { fulfillment };
	},
);
