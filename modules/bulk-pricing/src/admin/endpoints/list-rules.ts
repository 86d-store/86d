import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { BulkPricingController, ListRulesParams } from "../../service";

export const listRules = createAdminEndpoint(
	"/admin/bulk-pricing/rules",
	{
		method: "GET",
		query: z.object({
			scope: z.enum(["product", "variant", "collection", "global"]).optional(),
			targetId: z.string().min(1).optional(),
			active: z.coerce.boolean().optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const params: ListRulesParams = {};
		if (ctx.query.scope != null) params.scope = ctx.query.scope;
		if (ctx.query.targetId != null) params.targetId = ctx.query.targetId;
		if (ctx.query.active != null) params.active = ctx.query.active;
		if (ctx.query.take != null) params.take = ctx.query.take;
		if (ctx.query.skip != null) params.skip = ctx.query.skip;
		const rules = await controller.listRules(params);
		return { rules };
	},
);
