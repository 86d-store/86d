import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { PreordersController } from "../../service";

export const cancelCampaign = createAdminEndpoint(
	"/admin/preorders/campaigns/:id/cancel",
	{
		method: "POST",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			reason: z.string().max(500).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaign = await controller.cancelCampaign(
			ctx.params.id,
			ctx.body.reason,
		);
		if (!campaign) {
			return { error: "Campaign not found", campaign: null };
		}
		return { campaign };
	},
);
