import { createAdminEndpoint } from "@86d-app/core/api";
import type { BookingStatus, DeliverySlotsController } from "../../service";

export const listBookings = createAdminEndpoint(
	"/admin/delivery-slots/bookings",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const params: import("../../service").ListBookingsParams = {};
		const q = ctx.query as Record<string, string | undefined>;
		if (q.deliveryDate != null) params.deliveryDate = q.deliveryDate;
		if (q.orderId != null) params.orderId = q.orderId;
		if (q.customerId != null) params.customerId = q.customerId;
		if (q.status != null) params.status = q.status as BookingStatus;
		if (q.take != null) params.take = Number(q.take);
		if (q.skip != null) params.skip = Number(q.skip);
		const bookings = await controller.listBookings(params);
		return { bookings };
	},
);
