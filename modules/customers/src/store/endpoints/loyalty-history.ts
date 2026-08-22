import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CustomerController } from "../../service";

export const getLoyaltyHistory = createStoreEndpoint(
	"/customers/me/loyalty/history",
	{
		method: "GET",
		query: z.object({
			limit: z.coerce.number().min(1).max(100).optional(),
			offset: z.coerce.number().min(0).optional(),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const controller = ctx.context.controllers.customer as CustomerController;
		const result = await controller.getLoyaltyHistory(userId, {
			limit: ctx.query.limit,
			offset: ctx.query.offset,
		});
		return result;
	},
);
