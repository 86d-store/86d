import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AppointmentController } from "../../service";

export const listMyAppointments = createStoreEndpoint(
	"/appointments/me",
	{
		method: "GET",
		query: z.object({
			status: z.string().max(50).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
			offset: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const customerId = ctx.context.session?.user.id;
		if (!customerId) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const params: Parameters<typeof controller.listAppointments>[0] = {
			customerId,
		};
		if (ctx.query.status) {
			params.status = ctx.query.status as
				| "pending"
				| "confirmed"
				| "completed"
				| "cancelled"
				| "no-show";
		}
		if (ctx.query.limit !== undefined) params.take = ctx.query.limit;
		if (ctx.query.offset !== undefined) params.skip = ctx.query.offset;

		const appointments = await controller.listAppointments(params);

		return { appointments };
	},
);
