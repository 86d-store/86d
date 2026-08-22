import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { WishController, WishOrderStatus } from "../../service";

export const listOrdersEndpoint = createAdminEndpoint(
	"/admin/wish/orders",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum([
					"pending",
					"approved",
					"shipped",
					"delivered",
					"refunded",
					"cancelled",
				])
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.wish as WishController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listOrders({
			status: ctx.query.status as WishOrderStatus | undefined,
		});
		const total = all.length;
		const orders = all.slice(skip, skip + limit);
		return { orders, total };
	},
);
