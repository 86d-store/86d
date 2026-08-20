import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AppointmentController } from "../../service";

export const deleteService = createAdminEndpoint(
	"/admin/appointments/services/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const deleted = await controller.deleteService(ctx.params.id);
		if (!deleted) {
			return { error: "Service not found", status: 404 };
		}

		return { success: true };
	},
);
