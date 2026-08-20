import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AppointmentController } from "../../service";

export const getServiceAdmin = createAdminEndpoint(
	"/admin/appointments/services/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().max(200) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const service = await controller.getService(ctx.params.id);
		if (!service) {
			return { error: "Service not found", status: 404 };
		}

		const staff = await controller.getServiceStaff(service.id);

		return { service, staff };
	},
);
