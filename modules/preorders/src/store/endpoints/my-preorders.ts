import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PreordersController } from "../../service";

export const myPreorders = createStoreEndpoint(
	"/preorders/mine",
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

		const controller = ctx.context.controllers.preorders as PreordersController;
		const items = await controller.getCustomerPreorders(session.user.id, {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		return { items, total: items.length };
	},
);
