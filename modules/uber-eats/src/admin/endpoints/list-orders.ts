import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { UberEatsController, UberOrderStatus } from "../../service";

export const listOrdersEndpoint = createAdminEndpoint(
	"/admin/uber-eats/orders",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum([
					"pending",
					"accepted",
					"preparing",
					"ready",
					"picked-up",
					"delivered",
					"cancelled",
				])
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers[
			"uber-eats"
		] as UberEatsController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;

		// Fetch all matching for accurate total count, then slice for page
		const all = await controller.listOrders({
			status: ctx.query.status as UberOrderStatus | undefined,
		});
		const total = all.length;
		const orders = all.slice(skip, skip + limit);
		return { orders, total };
	},
);
