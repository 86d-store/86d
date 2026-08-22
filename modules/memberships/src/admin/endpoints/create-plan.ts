import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const createPlan = createAdminEndpoint(
	"/admin/memberships/plans/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			slug: z.string().min(1).max(200),
			description: z.string().max(5000).transform(sanitizeText).optional(),
			price: z.number().min(0),
			billingInterval: z.enum(["monthly", "yearly", "lifetime"]),
			trialDays: z.number().int().min(0).max(365).optional(),
			features: z.array(z.string().max(500)).max(50).optional(),
			isActive: z.boolean().optional(),
			maxMembers: z.number().int().min(1).optional(),
			sortOrder: z.number().int().min(0).max(10000).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const existing = await controller.getPlanBySlug(ctx.body.slug);
		if (existing) {
			return {
				error: "A plan with this slug already exists",
				status: 400,
			};
		}

		const params: Parameters<typeof controller.createPlan>[0] = {
			name: ctx.body.name,
			slug: ctx.body.slug,
			price: ctx.body.price,
			billingInterval: ctx.body.billingInterval,
		};
		if (ctx.body.description != null) params.description = ctx.body.description;
		if (ctx.body.trialDays != null) params.trialDays = ctx.body.trialDays;
		if (ctx.body.features != null) params.features = ctx.body.features;
		if (ctx.body.isActive != null) params.isActive = ctx.body.isActive;
		if (ctx.body.maxMembers != null) params.maxMembers = ctx.body.maxMembers;
		if (ctx.body.sortOrder != null) params.sortOrder = ctx.body.sortOrder;

		const plan = await controller.createPlan(params);

		return { plan };
	},
);
