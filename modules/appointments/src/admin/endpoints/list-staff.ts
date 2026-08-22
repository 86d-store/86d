import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { AppointmentController } from "../../service";

export const listStaffAdmin = createAdminEndpoint(
	"/admin/appointments/staff",
	{
		method: "GET",
		query: z
			.object({
				status: z.enum(["active", "inactive"]).optional(),
				take: z.coerce.number().int().min(1).max(100).optional(),
				skip: z.coerce.number().int().min(0).optional(),
			})
			.optional(),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const params: Parameters<typeof controller.listStaff>[0] = {};
		if (ctx.query?.status != null) params.status = ctx.query.status;
		if (ctx.query?.take != null) params.take = ctx.query.take;
		if (ctx.query?.skip != null) params.skip = ctx.query.skip;

		const staff = await controller.listStaff(params);

		return { staff };
	},
);
