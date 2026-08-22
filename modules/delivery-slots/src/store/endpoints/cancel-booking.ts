import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { DeliverySlotsController } from "../../service";

export const cancelBookingStore = createStoreEndpoint(
	"/delivery-slots/bookings/:id/cancel",
	{ method: "POST", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const existing = await controller.getBooking(ctx.params.id);
		if (!existing) return { error: "Booking not found", status: 404 };

		if (existing.customerId && existing.customerId !== session.user.id) {
			return { error: "Booking not found", status: 404 };
		}

		const booking = await controller.cancelBooking(ctx.params.id);
		if (!booking) return { error: "Booking not found", status: 404 };

		void ctx.context.events?.emit("delivery-slots.booking.cancelled", {
			id: booking.id,
			orderId: booking.orderId,
			customerId: booking.customerId,
		});
		return { booking };
	},
);
