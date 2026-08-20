import { createAdminEndpoint } from "@86d-app/core/api";
import type { AppointmentController } from "../../service";

export const getStats = createAdminEndpoint(
	"/admin/appointments/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const stats = await controller.getStats();

		return { stats };
	},
);
