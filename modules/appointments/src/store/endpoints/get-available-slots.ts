import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AppointmentController } from "../../service";

export const getAvailableSlots = createStoreEndpoint(
	"/appointments/availability",
	{
		method: "GET",
		query: z.object({
			serviceId: z.string().min(1).max(100),
			staffId: z.string().min(1).max(100).optional(),
			date: z.coerce.date(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const params: Parameters<typeof controller.getAvailableSlots>[0] = {
			serviceId: ctx.query.serviceId,
			date: ctx.query.date,
		};
		if (ctx.query.staffId != null) params.staffId = ctx.query.staffId;

		const slots = await controller.getAvailableSlots(params);

		return { slots };
	},
);
