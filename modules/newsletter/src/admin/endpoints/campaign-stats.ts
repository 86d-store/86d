import { createAdminEndpoint } from "@86d-app/core/api";
import type { NewsletterController } from "../../service";

export const campaignStatsEndpoint = createAdminEndpoint(
	"/admin/newsletter/campaigns/stats",
	{
		method: "GET",
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.newsletter as NewsletterController;
		const stats = await controller.getCampaignStats();
		return { stats };
	},
);
