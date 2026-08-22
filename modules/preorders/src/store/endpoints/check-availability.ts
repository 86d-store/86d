import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { PreordersController } from "../../service";

export const checkAvailability = createStoreEndpoint(
	"/preorders/check/:productId",
	{
		method: "GET",
		params: z.object({
			productId: z.string().max(200),
		}),
		query: z.object({
			variantId: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.preorders as PreordersController;
		const campaign = await controller.getActiveCampaignForProduct(
			ctx.params.productId,
			ctx.query.variantId,
		);

		if (!campaign) {
			return { available: false, campaign: null };
		}

		const remainingQuantity =
			campaign.maxQuantity !== undefined
				? campaign.maxQuantity - campaign.currentQuantity
				: null;

		return {
			available: true,
			campaign: {
				id: campaign.id,
				paymentType: campaign.paymentType,
				depositAmount: campaign.depositAmount,
				depositPercent: campaign.depositPercent,
				price: campaign.price,
				estimatedShipDate: campaign.estimatedShipDate,
				message: campaign.message,
				remainingQuantity,
			},
		};
	},
);
