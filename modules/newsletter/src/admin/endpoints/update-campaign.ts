import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeHtml, sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { NewsletterController } from "../../service";

export const updateCampaignEndpoint = createAdminEndpoint(
	"/admin/newsletter/campaigns/:id",
	{
		method: "PUT",
		params: z.object({ id: z.string() }),
		body: z.object({
			subject: z.string().min(1).max(200).transform(sanitizeText).optional(),
			body: z.string().min(1).max(200000).transform(sanitizeHtml).optional(),
			tags: z
				.array(z.string().max(100).transform(sanitizeText))
				.max(50)
				.optional(),
			scheduledAt: z.coerce.date().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.newsletter as NewsletterController;
		const campaign = await controller.updateCampaign(ctx.params.id, {
			subject: ctx.body.subject,
			body: ctx.body.body,
			tags: ctx.body.tags,
			scheduledAt: ctx.body.scheduledAt,
		});
		if (!campaign)
			return { campaign: null, error: "Campaign not found or not editable" };
		return { campaign };
	},
);
