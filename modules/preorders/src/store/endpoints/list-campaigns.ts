import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PreordersController } from "../../service";

export const listCampaigns = createStoreEndpoint(
	"/preorders/campaigns",
	{
		method: "GET",
		query: z.object({
			productId: z.string().max(200).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaigns = await controller.listCampaigns({
			status: "active",
			productId: ctx.query.productId,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});
		return { campaigns, total: campaigns.length };
	},
);
