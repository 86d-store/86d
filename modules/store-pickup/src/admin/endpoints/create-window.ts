import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CreateWindowParams, StorePickupController } from "../../service";

export const createWindow = createAdminEndpoint(
	"/admin/store-pickup/windows/create",
	{
		method: "POST",
		body: z.object({
			locationId: z.string().min(1),
			dayOfWeek: z.number().int().min(0).max(6),
			startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
			endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
			capacity: z.number().int().min(1),
			active: z.boolean().optional(),
			sortOrder: z.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const params: CreateWindowParams = {
			locationId: ctx.body.locationId,
			dayOfWeek: ctx.body.dayOfWeek,
			startTime: ctx.body.startTime,
			endTime: ctx.body.endTime,
			capacity: ctx.body.capacity,
		};
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;
		const window = await controller.createWindow(params);
		return { window };
	},
);
