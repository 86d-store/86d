import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DeliverySlotsController } from "../../service";

export const orderBooking = createStoreEndpoint(
	"/delivery-slots/order/:orderId",
	{ method: "GET", params: z.object({ orderId: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const booking = await controller.getOrderBooking(ctx.params.orderId);
		return { booking };
	},
);
