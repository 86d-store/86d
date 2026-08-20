import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AppointmentController } from "../../service";

export const getAppointment = createStoreEndpoint(
	"/appointments/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const appointment = await controller.getAppointment(ctx.params.id);
		if (!appointment) {
			return { error: "Appointment not found", status: 404 };
		}

		return { appointment };
	},
);
