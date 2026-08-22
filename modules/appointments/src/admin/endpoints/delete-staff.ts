import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AppointmentController } from "../../service";

export const deleteStaff = createAdminEndpoint(
	"/admin/appointments/staff/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const deleted = await controller.deleteStaff(ctx.params.id);
		if (!deleted) {
			return { error: "Staff member not found", status: 404 };
		}

		return { success: true };
	},
);
