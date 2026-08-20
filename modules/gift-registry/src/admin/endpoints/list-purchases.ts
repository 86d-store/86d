import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { GiftRegistryController } from "../../service";

export const listPurchases = createAdminEndpoint(
	"/admin/gift-registry/:id/purchases",
	{
		method: "GET",
		params: z.object({ id: z.string() }),
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.giftRegistry as GiftRegistryController;
		const params: { take?: number; skip?: number } = {
			take: ctx.query.take ?? 20,
		};
		if (ctx.query.skip != null) params.skip = ctx.query.skip;

		const purchases = await controller.listPurchases(ctx.params.id, params);
		return { purchases };
	},
);
