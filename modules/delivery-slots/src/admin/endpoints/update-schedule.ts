import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DeliverySlotsController } from "../../service";

export const updateSchedule = createAdminEndpoint(
	"/admin/delivery-slots/:id/update",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).optional(),
			dayOfWeek: z.number().int().min(0).max(6).optional(),
			startTime: z
				.string()
				.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
				.optional(),
			endTime: z
				.string()
				.regex(/^([01]\d|2[0-3]):[0-5]\d$/)
				.optional(),
			capacity: z.number().int().min(1).optional(),
			surchargeInCents: z.number().int().min(0).optional(),
			active: z.boolean().optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const params: import("../../service").UpdateScheduleParams = {};
		if (ctx.body.name != null) params.name = ctx.body.name;
		if (ctx.body.dayOfWeek != null) params.dayOfWeek = ctx.body.dayOfWeek;
		if (ctx.body.startTime != null) params.startTime = ctx.body.startTime;
		if (ctx.body.endTime != null) params.endTime = ctx.body.endTime;
		if (ctx.body.capacity != null) params.capacity = ctx.body.capacity;
		if (ctx.body.surchargeInCents != null)
			params.surchargeInCents = ctx.body.surchargeInCents;
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;
		const schedule = await controller.updateSchedule(ctx.params.id, params);
		if (!schedule) return { error: "Schedule not found" };
		return { schedule };
	},
);
