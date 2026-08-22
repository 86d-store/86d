import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { NewsletterController } from "../../service";

export const sendCampaignEndpoint = createAdminEndpoint(
	"/admin/newsletter/campaigns/:id/send",
	{
		method: "POST",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.newsletter as NewsletterController;
		const campaign = await controller.sendCampaign(ctx.params.id);
		if (!campaign)
			return { campaign: null, error: "Campaign not found or already sent" };
		return { campaign };
	},
);
