import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DeliverySlotsController } from "../../service";

export const availableSlots = createStoreEndpoint(
	"/delivery-slots/available",
	{
		method: "GET",
		query: z.object({
			date: z
				.string()
				.max(10)
				.regex(/^\d{4}-\d{2}-\d{2}$/),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const slots = await controller.getAvailableSlots({
			date: ctx.query.date,
		});
		return { slots };
	},
);
