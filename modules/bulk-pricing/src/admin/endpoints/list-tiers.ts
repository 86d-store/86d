import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BulkPricingController, ListTiersParams } from "../../service";

export const listTiers = createAdminEndpoint(
	"/admin/bulk-pricing/tiers",
	{
		method: "GET",
		query: z.object({
			ruleId: z.string().min(1),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const params: ListTiersParams = { ruleId: ctx.query.ruleId };
		if (ctx.query.take != null) params.take = ctx.query.take;
		if (ctx.query.skip != null) params.skip = ctx.query.skip;
		const tiers = await controller.listTiers(params);
		return { tiers };
	},
);
