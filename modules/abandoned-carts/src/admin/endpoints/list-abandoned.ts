import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { AbandonedCartController } from "../../service";

export const listAbandoned = createAdminEndpoint(
	"/admin/abandoned-carts",
	{
		method: "GET",
		query: z.object({
			status: z.string().max(50).optional(),
			email: z.string().max(255).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.abandonedCarts as AbandonedCartController;
		const [carts, total] = await Promise.all([
			controller.list({
				status: ctx.query.status,
				email: ctx.query.email,
				take: ctx.query.take,
				skip: ctx.query.skip,
			}),
			controller.countAll(),
		]);
		return { carts, total };
	},
);
