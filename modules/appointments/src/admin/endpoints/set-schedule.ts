import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AppointmentController } from "../../service";

export const setSchedule = createAdminEndpoint(
	"/admin/appointments/staff/:id/schedule",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			dayOfWeek: z.number().int().min(0).max(6),
			startTime: z.string().regex(/^\d{2}:\d{2}$/),
			endTime: z.string().regex(/^\d{2}:\d{2}$/),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const schedule = await controller.setSchedule({
			staffId: ctx.params.id,
			dayOfWeek: ctx.body.dayOfWeek,
			startTime: ctx.body.startTime,
			endTime: ctx.body.endTime,
		});

		return { schedule };
	},
);
