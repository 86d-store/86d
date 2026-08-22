import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DeliverySlotsController } from "../../service";

export const cancelBooking = createAdminEndpoint(
	"/admin/delivery-slots/bookings/:id/cancel",
	{ method: "POST", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const booking = await controller.cancelBooking(ctx.params.id);
		if (!booking) return { error: "Booking not found" };
		return { booking };
	},
);
