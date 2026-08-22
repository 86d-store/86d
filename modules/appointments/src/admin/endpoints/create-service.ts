import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { AppointmentController } from "../../service";

export const createService = createAdminEndpoint(
	"/admin/appointments/services/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			duration: z.number().int().min(1).max(1440),
			price: z.number().min(0),
			currency: z.string().length(3).optional(),
			status: z.enum(["active", "inactive"]).optional(),
			maxCapacity: z.number().int().min(1).optional(),
			sortOrder: z.number().int().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.appointments as AppointmentController;

		const existing = await controller.getServiceBySlug(ctx.body.slug);
		if (existing) {
			return {
				error: "A service with this slug already exists",
				status: 400,
			};
		}

		const params: Parameters<typeof controller.createService>[0] = {
			name: ctx.body.name,
			slug: ctx.body.slug,
			duration: ctx.body.duration,
			price: ctx.body.price,
		};
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.currency != null) params.currency = ctx.body.currency;
		if (ctx.body.status != null) params.status = ctx.body.status;
		if (ctx.body.maxCapacity != null) params.maxCapacity = ctx.body.maxCapacity;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;

		const service = await controller.createService(params);

		return { service };
	},
);
