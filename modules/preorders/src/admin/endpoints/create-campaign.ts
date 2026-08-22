import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { PreordersController } from "../../service";

export const createCampaign = createAdminEndpoint(
	"/admin/preorders/campaigns/create",
	{
		method: "POST",
		body: z.object({
			productId: z.string(),
			productName: z.string().max(500).transform(sanitizeText),
			variantId: z.string().max(200).optional(),
			variantLabel: z.string().max(200).transform(sanitizeText).optional(),
			paymentType: z.enum(["full", "deposit"]),
			depositAmount: z.number().min(0).optional(),
			depositPercent: z.number().min(0).max(100).optional(),
			price: z.number().min(0),
			maxQuantity: z.number().int().min(1).optional(),
			startDate: z.coerce.date(),
			endDate: z.coerce.date().optional(),
			estimatedShipDate: z.coerce.date().optional(),
			message: z.string().max(1000).transform(sanitizeText).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaign = await controller.createCampaign({
			productId: ctx.body.productId,
			productName: ctx.body.productName,
			variantId: ctx.body.variantId,
			variantLabel: ctx.body.variantLabel,
			paymentType: ctx.body.paymentType,
			depositAmount: ctx.body.depositAmount,
			depositPercent: ctx.body.depositPercent,
			price: ctx.body.price,
			maxQuantity: ctx.body.maxQuantity,
			startDate: ctx.body.startDate,
			endDate: ctx.body.endDate,
			estimatedShipDate: ctx.body.estimatedShipDate,
			message: ctx.body.message,
		});
		return { campaign };
	},
);
