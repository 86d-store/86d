import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PreordersController } from "../../service";

export const completeCampaign = createAdminEndpoint(
	"/admin/preorders/campaigns/:id/complete",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaign = await controller.completeCampaign(ctx.params.id);
		if (!campaign) {
			return { error: "Cannot complete campaign", campaign: null };
		}
		void ctx.context.events?.emit("preorder.campaign.completed", {
			campaignId: campaign.id,
			productId: campaign.productId,
		});
		return { campaign };
	},
);
