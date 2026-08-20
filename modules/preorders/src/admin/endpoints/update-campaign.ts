import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { PreordersController } from "../../service";

export const updateCampaign = createAdminEndpoint(
	"/admin/preorders/campaigns/:id/update",
	{
		method: "PATCH",
		params: z.object({
			id: z.string(),
		}),
		body: z.object({
			productName: z.string().max(500).transform(sanitizeText).optional(),
			paymentType: z.enum(["full", "deposit"]).optional(),
			depositAmount: z.number().min(0).optional(),
			depositPercent: z.number().min(0).max(100).optional(),
			price: z.number().min(0).optional(),
			maxQuantity: z.number().int().min(1).optional(),
			endDate: z.coerce.date().optional(),
			estimatedShipDate: z.coerce.date().optional(),
			message: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaign = await controller.updateCampaign(ctx.params.id, ctx.body);
		if (!campaign) {
			return { error: "Campaign not found", campaign: null };
		}
		return { campaign };
	},
);
