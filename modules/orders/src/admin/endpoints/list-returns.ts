import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { OrderController, ReturnStatus } from "../../service";

export const adminListReturns = createAdminEndpoint(
	"/admin/orders/returns",
	{
		method: "GET",
		query: z.object({
			page: z.string().optional(),
			limit: z.string().optional(),
			status: z.string().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.order as OrderController;

		const page = Math.max(1, Number(ctx.query.page) || 1);
		const limit = Math.min(100, Math.max(1, Number(ctx.query.limit) || 20));
		const offset = (page - 1) * limit;

		const { returns, total } = await controller.listAllReturns({
			limit,
			offset,
			status: ctx.query.status as ReturnStatus | undefined,
		});

		return {
			returns,
			total,
			page,
			limit,
			pages: Math.ceil(total / limit),
		};
	},
);
