import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const gateProduct = createAdminEndpoint(
	"/admin/memberships/plans/:planId/products/gate",
	{
		method: "POST",
		params: z.object({ planId: z.string().min(1) }),
		body: z.object({
			productIds: z.array(z.string().min(1)).min(1).max(100),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const plan = await controller.getPlan(ctx.params.planId);
		if (!plan) {
			return { error: "Plan not found", status: 404 };
		}

		let gated = 0;
		for (const productId of ctx.body.productIds) {
			await controller.gateProduct({
				planId: ctx.params.planId,
				productId,
			});
			gated++;
		}

		return { gated };
	},
);
