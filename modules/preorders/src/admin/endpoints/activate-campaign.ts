import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { PreordersController } from "../../service";

export const activateCampaign = createAdminEndpoint(
	"/admin/preorders/campaigns/:id/activate",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaign = await controller.activateCampaign(ctx.params.id);
		if (!campaign) {
			return { error: "Cannot activate campaign", campaign: null };
		}
		void ctx.context.events?.emit("preorder.campaign.activated", {
			campaignId: campaign.id,
			productId: campaign.productId,
		});
		return { campaign };
	},
);
