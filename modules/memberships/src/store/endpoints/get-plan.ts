import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const getPlan = createStoreEndpoint(
	"/memberships/plans/:slug",
	{
		method: "GET",
		params: z.object({
			slug: z.string().min(1).max(200),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const plan = await controller.getPlanBySlug(ctx.params.slug);
		if (!plan?.isActive) {
			return { error: "Plan not found", status: 404 };
		}

		const benefits = await controller.listBenefits(plan.id);

		return { plan, benefits: benefits.filter((b) => b.isActive) };
	},
);
