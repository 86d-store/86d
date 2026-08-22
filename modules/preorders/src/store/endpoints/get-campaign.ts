import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PreordersController } from "../../service";

export const getCampaign = createStoreEndpoint(
	"/preorders/campaigns/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string().max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaign = await controller.getCampaign(ctx.params.id);
		if (campaign?.status !== "active") {
			return { campaign: null };
		}
		return { campaign };
	},
);
