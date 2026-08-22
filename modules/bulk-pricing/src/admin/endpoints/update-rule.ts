import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BulkPricingController, UpdateRuleParams } from "../../service";

export const updateRule = createAdminEndpoint(
	"/admin/bulk-pricing/rules/:id/update",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).optional(),
			description: z.string().max(1000).optional().nullable(),
			scope: z.enum(["product", "variant", "collection", "global"]).optional(),
			targetId: z.string().min(1).max(200).optional().nullable(),
			priority: z.number().int().optional(),
			active: z.boolean().optional(),
			startsAt: z.coerce.date().optional().nullable(),
			endsAt: z.coerce.date().optional().nullable(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const params: UpdateRuleParams = {};
		if (ctx.body.name != null) params.name = ctx.body.name;
		if (ctx.body.description !== undefined)
			params.description = ctx.body.description;
		if (ctx.body.scope != null) params.scope = ctx.body.scope;
		if (ctx.body.targetId !== undefined) params.targetId = ctx.body.targetId;
		if (ctx.body.priority != null) params.priority = ctx.body.priority;
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.startsAt !== undefined) params.startsAt = ctx.body.startsAt;
		if (ctx.body.endsAt !== undefined) params.endsAt = ctx.body.endsAt;
		const rule = await controller.updateRule(ctx.params.id, params);
		return { rule };
	},
);
