import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { UberDirectController } from "../../service";

export const updateDeliveryStatus = createAdminEndpoint(
	"/admin/uber-direct/deliveries/:id/status",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			status: z.enum([
				"pending",
				"quoted",
				"accepted",
				"picked-up",
				"delivered",
				"cancelled",
				"failed",
			]),
			externalId: z.string().max(500).optional(),
			trackingUrl: z.string().max(2000).optional(),
			courierName: z.string().max(200).transform(sanitizeText).optional(),
			courierPhone: z.string().max(50).optional(),
			courierVehicle: z.string().max(200).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.uberDirect as UberDirectController;
		const delivery = await controller.updateDeliveryStatus(
			ctx.params.id,
			ctx.body.status,
			{
				...(ctx.body.externalId !== undefined
					? { externalId: ctx.body.externalId }
					: {}),
				...(ctx.body.trackingUrl !== undefined
					? { trackingUrl: ctx.body.trackingUrl }
					: {}),
				...(ctx.body.courierName !== undefined
					? { courierName: ctx.body.courierName }
					: {}),
				...(ctx.body.courierPhone !== undefined
					? { courierPhone: ctx.body.courierPhone }
					: {}),
				...(ctx.body.courierVehicle !== undefined
					? { courierVehicle: ctx.body.courierVehicle }
					: {}),
			},
		);

		if (!delivery) {
			return { error: "Delivery not found", status: 404 };
		}

		return { delivery };
	},
);
