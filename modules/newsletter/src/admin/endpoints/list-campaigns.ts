import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { CampaignStatus, NewsletterController } from "../../service";

export const listCampaignsEndpoint = createAdminEndpoint(
	"/admin/newsletter/campaigns",
	{
		method: "GET",
		query: z.object({
			status: z.enum(["draft", "scheduled", "sending", "sent"]).optional(),
			page: z.coerce.number().int().min(1).optional(),
			limit: z.coerce.number().int().min(1).max(100).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.newsletter as NewsletterController;
		const limit = ctx.query.limit ?? 50;
		const page = ctx.query.page ?? 1;
		const skip = (page - 1) * limit;
		const all = await controller.listCampaigns({
			status: ctx.query.status as CampaignStatus | undefined,
		});
		const total = all.length;
		const campaigns = all.slice(skip, skip + limit);
		return { campaigns, total };
	},
);
