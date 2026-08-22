import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { EbayController } from "../../service";

export const shipOrderEndpoint = createAdminEndpoint(
	"/admin/ebay/orders/:id/ship",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			trackingNumber: z.string().min(1).max(200),
			carrier: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.ebay as EbayController;
		const order = await controller.shipOrder(
			ctx.params.id,
			ctx.body.trackingNumber,
			ctx.body.carrier,
		);
		return { order };
	},
);
