import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { MembershipController } from "../../service";

export const updatePlan = createAdminEndpoint(
	"/admin/memberships/plans/:id/update",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText).optional(),
			slug: z.string().min(1).max(200).optional(),
			description: z
				.string()
				.max(5000)
				.transform(sanitizeText)
				.nullable()
				.optional(),
			price: z.number().min(0).optional(),
			billingInterval: z.enum(["monthly", "yearly", "lifetime"]).optional(),
			trialDays: z.number().int().min(0).max(365).optional(),
			features: z.array(z.string().max(500)).max(50).nullable().optional(),
			isActive: z.boolean().optional(),
			maxMembers: z.number().int().min(1).nullable().optional(),
			sortOrder: z.number().int().min(0).max(10000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		if (ctx.body.slug != null) {
			const existing = await controller.getPlanBySlug(ctx.body.slug);
			if (existing && existing.id !== ctx.params.id) {
				return {
					error: "A plan with this slug already exists",
					status: 400,
				};
			}
		}

		const updateParams: Parameters<typeof controller.updatePlan>[1] = {};
		if (ctx.body.name != null) updateParams.name = ctx.body.name;
		if (ctx.body.slug != null) updateParams.slug = ctx.body.slug;
		if (ctx.body.description !== undefined)
			updateParams.description = ctx.body.description;
		if (ctx.body.price != null) updateParams.price = ctx.body.price;
		if (ctx.body.billingInterval != null)
			updateParams.billingInterval = ctx.body.billingInterval;
		if (ctx.body.trialDays != null) updateParams.trialDays = ctx.body.trialDays;
		if (ctx.body.features !== undefined)
			updateParams.features = ctx.body.features;
		if (ctx.body.isActive != null) updateParams.isActive = ctx.body.isActive;
		if (ctx.body.maxMembers !== undefined)
			updateParams.maxMembers = ctx.body.maxMembers;
		if (ctx.body.sortOrder != null) updateParams.sortOrder = ctx.body.sortOrder;

		const plan = await controller.updatePlan(ctx.params.id, updateParams);
		if (!plan) {
			return { error: "Plan not found", status: 404 };
		}

		return { plan };
	},
);
