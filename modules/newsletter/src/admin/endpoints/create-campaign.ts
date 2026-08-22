import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeHtml, sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { NewsletterController } from "../../service";

export const createCampaignEndpoint = createAdminEndpoint(
	"/admin/newsletter/campaigns/create",
	{
		method: "POST",
		body: z.object({
			subject: z.string().min(1).max(200).transform(sanitizeText),
			body: z.string().min(1).max(200000).transform(sanitizeHtml),
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
		const campaign = await controller.createCampaign({
			subject: ctx.body.subject,
			body: ctx.body.body,
			tags: ctx.body.tags,
			scheduledAt: ctx.body.scheduledAt,
		});
		return { campaign };
	},
);
