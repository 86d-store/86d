import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { DeliverySlotsController } from "../../service";

export const bookSlot = createStoreEndpoint(
	"/delivery-slots/book",
	{
		method: "POST",
		body: z.object({
			scheduleId: z.string().min(1).max(200),
			deliveryDate: z
				.string()
				.max(10)
				.regex(/^\d{4}-\d{2}-\d{2}$/),
			orderId: z.string().min(1).max(200),
			instructions: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const params: import("../../service").BookSlotParams = {
			scheduleId: ctx.body.scheduleId,
			deliveryDate: ctx.body.deliveryDate,
			orderId: ctx.body.orderId,
			customerId: session.user.id,
		};
		if (ctx.body.instructions != null)
			params.instructions = ctx.body.instructions;
		const booking = await controller.bookSlot(params);
		void ctx.context.events?.emit("delivery-slots.booking.created", {
			id: booking.id,
			orderId: booking.orderId,
			customerId: booking.customerId,
			deliveryDate: booking.deliveryDate,
		});
		return { booking };
	},
);
