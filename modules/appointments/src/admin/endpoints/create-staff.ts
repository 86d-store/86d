import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { AppointmentController } from "../../service";

export const createStaff = createAdminEndpoint(
	"/admin/appointments/staff/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			email: z.string().email().max(320),
			bio: z.string().max(5000).transform(sanitizeText).optional(),
			status: z.enum(["active", "inactive"]).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const params: Parameters<typeof controller.createStaff>[0] = {
			name: ctx.body.name,
			email: ctx.body.email,
		};
		if (ctx.body.bio != null) params.bio = ctx.body.bio;
		if (ctx.body.status != null) params.status = ctx.body.status;

		const staff = await controller.createStaff(params);

		return { staff };
	},
);
