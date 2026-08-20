import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ListWindowsParams, StorePickupController } from "../../service";

export const listWindows = createAdminEndpoint(
	"/admin/store-pickup/windows",
	{
		method: "GET",
		query: z.object({
			locationId: z.string().min(1),
			dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
			active: z.coerce.boolean().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const params: ListWindowsParams = {
			locationId: ctx.query.locationId,
		};
		if (ctx.query.dayOfWeek != null) params.dayOfWeek = ctx.query.dayOfWeek;
		if (ctx.query.active != null) params.active = ctx.query.active;
		if (ctx.query.take != null) params.take = ctx.query.take;
		if (ctx.query.skip != null) params.skip = ctx.query.skip;
		const windows = await controller.listWindows(params);
		return { windows };
	},
);
