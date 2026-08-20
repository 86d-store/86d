import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { EbayController, EbayOrderStatus } from "../../service";

export const listOrdersEndpoint = createAdminEndpoint(
	"/admin/ebay/orders",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum([
					"pending",
					"paid",
					"shipped",
					"delivered",
					"cancelled",
					"returned",
				])
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.ebay as EbayController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listOrders({
			status: ctx.query.status as EbayOrderStatus | undefined,
		});
		const total = all.length;
		const orders = all.slice(skip, skip + limit);
		return { orders, total };
	},
);
