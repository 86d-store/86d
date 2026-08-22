import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { ReturnController } from "../../service";

export const listCustomerReturns = createStoreEndpoint(
	"/returns",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(50).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user?.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.returns as ReturnController;
		const returns = await controller.getByCustomerId(userId, {
			take: ctx.query.take,
			skip: ctx.query.skip,
		});

		return { returns };
	},
);
