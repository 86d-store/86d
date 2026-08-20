import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BulkPricingController, CreateTierParams } from "../../service";

export const createTier = createAdminEndpoint(
	"/admin/bulk-pricing/tiers/create",
	{
		method: "POST",
		body: z.object({
			ruleId: z.string().min(1),
			minQuantity: z.number().int().min(1),
			maxQuantity: z.number().int().min(1).optional(),
			discountType: z.enum(["percentage", "fixed_amount", "fixed_price"]),
			discountValue: z.number().min(0),
			label: z.string().max(200).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const params: CreateTierParams = {
			ruleId: ctx.body.ruleId,
			minQuantity: ctx.body.minQuantity,
			discountType: ctx.body.discountType,
			discountValue: ctx.body.discountValue,
		};
		if (ctx.body.maxQuantity != null) params.maxQuantity = ctx.body.maxQuantity;
		if (ctx.body.label != null) params.label = ctx.body.label;
		const tier = await controller.createTier(params);
		return { tier };
	},
);
