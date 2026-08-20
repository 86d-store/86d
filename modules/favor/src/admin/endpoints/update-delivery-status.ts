import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { FavorController } from "../../service";

export const updateDeliveryStatus = createAdminEndpoint(
	"/admin/favor/deliveries/:id/status",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z.enum([
				"pending",
				"assigned",
				"en-route",
				"arrived",
				"completed",
				"cancelled",
			]),
			externalId: z.string().max(500).optional(),
			runnerName: z.string().max(200).transform(sanitizeText).optional(),
			runnerPhone: z.string().max(50).optional(),
			trackingUrl: z.string().max(2000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.favor as FavorController;
		const delivery = await controller.updateDeliveryStatus(
			ctx.params.id,
			ctx.body.status,
			{
				...(ctx.body.externalId !== undefined
					? { externalId: ctx.body.externalId }
					: {}),
				...(ctx.body.runnerName !== undefined
					? { runnerName: ctx.body.runnerName }
					: {}),
				...(ctx.body.runnerPhone !== undefined
					? { runnerPhone: ctx.body.runnerPhone }
					: {}),
				...(ctx.body.trackingUrl !== undefined
					? { trackingUrl: ctx.body.trackingUrl }
					: {}),
			},
		);

		if (!delivery) {
			return { error: "Delivery not found", status: 404 };
		}

		return { delivery };
	},
);
