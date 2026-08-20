import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BulkPricingController, UpdateTierParams } from "../../service";

export const updateTier = createAdminEndpoint(
	"/admin/bulk-pricing/tiers/:id/update",
	{
		method: "POST",
		body: z.object({
			minQuantity: z.number().int().min(1).optional(),
			maxQuantity: z.number().int().min(1).optional().nullable(),
			discountType: z
				.enum(["percentage", "fixed_amount", "fixed_price"])
				.optional(),
			discountValue: z.number().min(0).optional(),
			label: z.string().max(200).optional().nullable(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const params: UpdateTierParams = {};
		if (ctx.body.minQuantity != null) params.minQuantity = ctx.body.minQuantity;
		if (ctx.body.maxQuantity !== undefined)
			params.maxQuantity = ctx.body.maxQuantity;
		if (ctx.body.discountType != null)
			params.discountType = ctx.body.discountType;
		if (ctx.body.discountValue != null)
			params.discountValue = ctx.body.discountValue;
		if (ctx.body.label !== undefined) params.label = ctx.body.label;
		const tier = await controller.updateTier(ctx.params.id, params);
		return { tier };
	},
);
