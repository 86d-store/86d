import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { StorePickupController, UpdateWindowParams } from "../../service";

export const updateWindow = createAdminEndpoint(
	"/admin/store-pickup/windows/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1),
		}),
		body: z.object({
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
			active: z.boolean().optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const params: UpdateWindowParams = {};
		if (ctx.body.dayOfWeek != null) params.dayOfWeek = ctx.body.dayOfWeek;
		if (ctx.body.startTime != null) params.startTime = ctx.body.startTime;
		if (ctx.body.endTime != null) params.endTime = ctx.body.endTime;
		if (ctx.body.capacity != null) params.capacity = ctx.body.capacity;
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;
		const window = await controller.updateWindow(ctx.params.id, params);
		if (!window) {
			return { error: "Window not found", status: 404 };
		}
		return { window };
	},
);
