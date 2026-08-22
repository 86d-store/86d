import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { AppointmentController } from "../../service";

export const updateStaff = createAdminEndpoint(
	"/admin/appointments/staff/:id/update",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			email: z.string().email().max(320).optional(),
			bio: z.string().max(5000).transform(sanitizeText).nullable().optional(),
			status: z.enum(["active", "inactive"]).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const params: Parameters<typeof controller.updateStaff>[1] = {};
		if (ctx.body.name != null) params.name = ctx.body.name;
		if (ctx.body.email != null) params.email = ctx.body.email;
		if (ctx.body.bio !== undefined) params.bio = ctx.body.bio;
		if (ctx.body.status != null) params.status = ctx.body.status;

		const staff = await controller.updateStaff(ctx.params.id, params);
		if (!staff) {
			return { error: "Staff member not found", status: 404 };
		}

		return { staff };
	},
);
