import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BackordersController } from "../../service";

export const myBackorders = createStoreEndpoint(
	"/backorders/mine",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const session = ctx.context.session;
		if (!session) {
			return { error: "Authentication required", status: 401 };
		}

		const controller = ctx.context.controllers
			.backorders as BackordersController;
		const backorders = await controller.getCustomerBackorders(session.user.id, {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		return { backorders };
	},
);
