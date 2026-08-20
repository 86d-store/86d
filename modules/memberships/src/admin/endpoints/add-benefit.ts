import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { MembershipController } from "../../service";

export const addBenefit = createAdminEndpoint(
	"/admin/memberships/plans/:planId/benefits/add",
	{
		method: "POST",
		params: z.object({ planId: z.string().min(1) }),
		body: z.object({
			type: z.enum([
				"discount_percentage",
				"free_shipping",
				"early_access",
				"exclusive_products",
				"priority_support",
			]),
			value: z.string().min(1).max(200),
			description: z.string().max(1000).transform(sanitizeText).optional(),
			isActive: z.boolean().optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const plan = await controller.getPlan(ctx.params.planId);
		if (!plan) {
			return { error: "Plan not found", status: 404 };
		}

		const params: Parameters<typeof controller.addBenefit>[0] = {
			planId: ctx.params.planId,
			type: ctx.body.type,
			value: ctx.body.value,
		};
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.isActive != null) params.isActive = ctx.body.isActive;

		const benefit = await controller.addBenefit(params);

		return { benefit };
	},
);
