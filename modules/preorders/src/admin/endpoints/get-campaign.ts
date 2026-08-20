import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PreordersController } from "../../service";

export const getCampaignAdmin = createAdminEndpoint(
	"/admin/preorders/campaigns/:id",
	{
		method: "GET",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaign = await controller.getCampaign(ctx.params.id);
		if (!campaign) {
			return { error: "Campaign not found", campaign: null, items: [] };
		}
		const items = await controller.listPreorderItems({
			campaignId: ctx.params.id,
		});
		return { campaign, items };
	},
);
