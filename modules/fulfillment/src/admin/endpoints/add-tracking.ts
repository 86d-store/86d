import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { FulfillmentController } from "../../service";

export const addTracking = createAdminEndpoint(
	"/admin/fulfillment/:id/tracking",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
		body: z.object({
			carrier: z.string().min(1).max(100).transform(sanitizeText),
			trackingNumber: z.string().min(1).max(200).transform(sanitizeText),
			trackingUrl: z.string().url().max(2000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.fulfillment as FulfillmentController;
		const fulfillment = await controller.addTracking(ctx.params.id, {
			carrier: ctx.body.carrier,
			trackingNumber: ctx.body.trackingNumber,
			trackingUrl: ctx.body.trackingUrl,
		});
		if (!fulfillment) {
			return { error: "Fulfillment not found", status: 404 };
		}
		return { fulfillment };
	},
);
