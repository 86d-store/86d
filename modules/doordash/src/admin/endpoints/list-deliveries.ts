import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { DeliveryStatus, DoordashController } from "../../service";

export const listDeliveriesEndpoint = createAdminEndpoint(
	"/admin/doordash/deliveries",
	{
		method: "GET",
		query: z.object({
			status: z
				.enum(["pending", "accepted", "picked-up", "delivered", "cancelled"])
				.optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.doordash as DoordashController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listDeliveries({
			status: ctx.query.status as DeliveryStatus | undefined,
		});
		const total = all.length;
		const deliveries = all.slice(skip, skip + limit);
		return { deliveries, total };
	},
);
