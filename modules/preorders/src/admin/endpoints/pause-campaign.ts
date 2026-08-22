import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PreordersController } from "../../service";

export const pauseCampaign = createAdminEndpoint(
	"/admin/preorders/campaigns/:id/pause",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaign = await controller.pauseCampaign(ctx.params.id);
		if (!campaign) {
			return { error: "Cannot pause campaign", campaign: null };
		}
		return { campaign };
	},
);
