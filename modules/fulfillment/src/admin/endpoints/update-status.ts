import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FulfillmentController } from "../../service";

export const updateStatus = createAdminEndpoint(
	"/admin/fulfillment/:id/status",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
		body: z.object({
			status: z.enum([
				"pending",
				"processing",
				"shipped",
				"delivered",
				"cancelled",
			]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.fulfillment as FulfillmentController;
		const fulfillment = await controller.updateStatus(
			ctx.params.id,
			ctx.body.status,
		);
		if (!fulfillment) {
			return { error: "Fulfillment not found", status: 404 };
		}
		return { fulfillment };
	},
);
