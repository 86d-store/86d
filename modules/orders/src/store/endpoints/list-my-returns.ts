import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { OrderController, ReturnStatus } from "../../service";

export const listMyReturns = createStoreEndpoint(
	"/orders/me/returns",
	{
		method: "GET",
		query: z.object({
			page: z.coerce.number().int().positive().optional().default(1),
			limit: z.coerce.number().int().positive().max(50).optional().default(10),
			status: z
				.enum([
					"requested",
					"approved",
					"rejected",
					"shipped_back",
					"received",
					"refunded",
					"completed",
				])
				.optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const { page, limit, status } = ctx.query;
		const offset = (page - 1) * limit;

		const controller = ctx.context.controllers.order as OrderController;
		const { returns, total } = await controller.listReturnsForCustomer(userId, {
			limit,
			offset,
			status: status as ReturnStatus | undefined,
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
