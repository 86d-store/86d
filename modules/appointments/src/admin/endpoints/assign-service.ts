import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AppointmentController } from "../../service";

export const assignServiceToStaff = createAdminEndpoint(
	"/admin/appointments/staff/:id/services/assign",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
		body: z.object({
			serviceId: z.string().min(1),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const assignment = await controller.assignService(
			ctx.params.id,
			ctx.body.serviceId,
		);

		return { assignment };
	},
);
