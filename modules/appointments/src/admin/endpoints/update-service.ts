import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { AppointmentController } from "../../service";

export const updateService = createAdminEndpoint(
	"/admin/appointments/services/:id/update",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().min(1).max(200).optional(),
			description: z
				.string()
				.max(5000)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			duration: z.number().int().min(1).max(1440).optional(),
			price: z.number().min(0).optional(),
			currency: z.string().length(3).optional(),
			status: z.enum(["active", "inactive"]).optional(),
			maxCapacity: z.number().int().min(1).optional(),
			sortOrder: z.number().int().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const params: Parameters<typeof controller.updateService>[1] = {};
		if (ctx.body.name != null) params.name = ctx.body.name;
		if (ctx.body.slug != null) params.slug = ctx.body.slug;
		if (ctx.body.description !== undefined)
			params.description = ctx.body.description;
		if (ctx.body.duration != null) params.duration = ctx.body.duration;
		if (ctx.body.price != null) params.price = ctx.body.price;
		if (ctx.body.currency != null) params.currency = ctx.body.currency;
		if (ctx.body.status != null) params.status = ctx.body.status;
		if (ctx.body.maxCapacity != null) params.maxCapacity = ctx.body.maxCapacity;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;

		const service = await controller.updateService(ctx.params.id, params);
		if (!service) {
			return { error: "Service not found", status: 404 };
		}

		return { service };
	},
);
