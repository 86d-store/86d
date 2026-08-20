import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DeliverySlotsController } from "../../service";

export const createSchedule = createAdminEndpoint(
	"/admin/delivery-slots/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200),
			dayOfWeek: z.number().int().min(0).max(6),
			startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
			endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
			capacity: z.number().int().min(1),
			surchargeInCents: z.number().int().min(0).optional(),
			active: z.boolean().optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.deliverySlots as DeliverySlotsController;
		const params: import("../../service").CreateScheduleParams = {
			name: ctx.body.name,
			dayOfWeek: ctx.body.dayOfWeek,
			startTime: ctx.body.startTime,
			endTime: ctx.body.endTime,
			capacity: ctx.body.capacity,
		};
		if (ctx.body.surchargeInCents != null)
			params.surchargeInCents = ctx.body.surchargeInCents;
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;
		const schedule = await controller.createSchedule(params);
		void ctx.context.events?.emit("delivery-slots.schedule.created", {
			scheduleId: schedule.id,
			name: schedule.name,
		});
		return { schedule };
	},
);
