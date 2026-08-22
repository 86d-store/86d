import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BulkPricingController, CreateRuleParams } from "../../service";

export const createRule = createAdminEndpoint(
	"/admin/bulk-pricing/rules/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200),
			description: z.string().max(1000).optional(),
			scope: z.enum(["product", "variant", "collection", "global"]),
			targetId: z.string().min(1).max(200).optional(),
			priority: z.number().int().optional(),
			active: z.boolean().optional(),
			startsAt: z.coerce.date().optional(),
			endsAt: z.coerce.date().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const params: CreateRuleParams = {
			name: ctx.body.name,
			scope: ctx.body.scope,
		};
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.targetId != null) params.targetId = ctx.body.targetId;
		if (ctx.body.priority != null) params.priority = ctx.body.priority;
		if (ctx.body.active != null) params.active = ctx.body.active;
		if (ctx.body.startsAt != null) params.startsAt = ctx.body.startsAt;
		if (ctx.body.endsAt != null) params.endsAt = ctx.body.endsAt;
		const rule = await controller.createRule(params);
		return { rule };
	},
);
