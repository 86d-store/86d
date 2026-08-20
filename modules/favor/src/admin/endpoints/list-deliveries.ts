import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { FavorController } from "../../service";

export const listDeliveries = createAdminEndpoint(
	"/admin/favor/deliveries",
	{
		method: "GET",
		query: z.object({
			status: z.string().optional(),
			orderId: z.string().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.favor as FavorController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;

		// Fetch all matching for accurate total count, then slice for page
		const all = await controller.listDeliveries({
			status: ctx.query.status,
			orderId: ctx.query.orderId,
		});
		const total = all.length;
		const deliveries = all.slice(skip, skip + take);
		return { deliveries, total };
	},
);
