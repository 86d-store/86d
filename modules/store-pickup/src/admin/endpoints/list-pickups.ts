import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { ListPickupsParams, StorePickupController } from "../../service";

export const listPickups = createAdminEndpoint(
	"/admin/store-pickup/pickups",
	{
		method: "GET",
		query: z.object({
			locationId: z.string().optional(),
			orderId: z.string().optional(),
			customerId: z.string().optional(),
			scheduledDate: z.string().optional(),
			status: z
				.enum(["scheduled", "preparing", "ready", "picked_up", "cancelled"])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.storePickup as StorePickupController;
		const params: ListPickupsParams = {};
		if (ctx.query.locationId != null) params.locationId = ctx.query.locationId;
		if (ctx.query.orderId != null) params.orderId = ctx.query.orderId;
		if (ctx.query.customerId != null) params.customerId = ctx.query.customerId;
		if (ctx.query.scheduledDate != null)
			params.scheduledDate = ctx.query.scheduledDate;
		if (ctx.query.status != null) params.status = ctx.query.status;
		if (ctx.query.take != null) params.take = ctx.query.take;
		if (ctx.query.skip != null) params.skip = ctx.query.skip;
		const pickups = await controller.listPickups(params);
		return { pickups };
	},
);
