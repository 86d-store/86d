import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BackordersController } from "../../service";

export const listBackorders = createAdminEndpoint(
	"/admin/backorders",
	{
		method: "GET",
		query: z.object({
			productId: z.string().optional(),
			customerId: z.string().optional(),
			status: z
				.enum([
					"pending",
					"confirmed",
					"allocated",
					"shipped",
					"delivered",
					"cancelled",
				])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const take = ctx.query.take ?? 50;
		const skip = ctx.query.skip ?? 0;
		const all = await controller.listBackorders({
			productId: ctx.query.productId,
			customerId: ctx.query.customerId,
			status: ctx.query.status,
		});
		const total = all.length;
		const backorders = all.slice(skip, skip + take);
		return { backorders, total };
	},
);
