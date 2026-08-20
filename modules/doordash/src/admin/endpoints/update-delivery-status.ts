import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DeliveryStatus, DoordashController } from "../../service";

export const updateDeliveryStatusEndpoint = createAdminEndpoint(
	"/admin/doordash/deliveries/:id/status",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z.enum([
				"pending",
				"accepted",
				"picked-up",
				"delivered",
				"cancelled",
			]),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.doordash as DoordashController;
		const delivery = await controller.updateDeliveryStatus(
			ctx.params.id,
			ctx.body.status as DeliveryStatus,
		);
		if (!delivery) return { error: "Delivery not found", status: 404 };
		return { delivery };
	},
);
