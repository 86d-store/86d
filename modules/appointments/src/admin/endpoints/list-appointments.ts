import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AppointmentController } from "../../service";

export const listAppointments = createAdminEndpoint(
	"/admin/appointments",
	{
		method: "GET",
		query: z
			.object({
				staffId: z.string().optional(),
				serviceId: z.string().optional(),
				status: z
					.enum(["pending", "confirmed", "cancelled", "completed", "no-show"])
					.optional(),
				take: z.coerce.number().int().min(1).max(100).optional(),
				skip: z.coerce.number().int().min(0).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const params: Parameters<typeof controller.listAppointments>[0] = {};
		if (ctx.query?.staffId != null) params.staffId = ctx.query.staffId;
		if (ctx.query?.serviceId != null) params.serviceId = ctx.query.serviceId;
		if (ctx.query?.status != null) params.status = ctx.query.status;
		if (ctx.query?.take != null) params.take = ctx.query.take;
		if (ctx.query?.skip != null) params.skip = ctx.query.skip;

		const appointments = await controller.listAppointments(params);

		return { appointments };
	},
);
