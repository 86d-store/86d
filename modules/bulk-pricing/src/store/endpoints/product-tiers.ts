import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BulkPricingController } from "../../service";

export const productTiers = createStoreEndpoint(
	"/bulk-pricing/product/:productId/tiers",
	{
		method: "GET",
		params: z.object({
			productId: z.string().min(1).max(200),
		}),
		query: z.object({
			basePrice: z.coerce.number().min(0),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const rules = await controller.listRules({
			scope: "product",
			targetId: ctx.params.productId,
			active: true,
		});
		if (rules.length === 0) return { tiers: [] };
		const previews = await controller.previewTiers(
			rules[0].id,
			ctx.query.basePrice,
		);
		return { tiers: previews };
	},
);
