import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DeliverySlotsController } from "../../service";

export const createBlackout = createAdminEndpoint(
	"/admin/delivery-slots/blackouts/create",
	{
		method: "POST",
		body: z.object({
			date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
			reason: z.string().max(500).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const params: import("../../service").CreateBlackoutParams = {
			date: ctx.body.date,
		};
		if (ctx.body.reason != null) params.reason = ctx.body.reason;
		const blackout = await controller.createBlackout(params);
		return { blackout };
	},
);
