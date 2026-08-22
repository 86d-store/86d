import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const ungateProduct = createAdminEndpoint(
	"/admin/memberships/plans/:planId/products/ungate",
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

		let ungated = 0;
		for (const productId of ctx.body.productIds) {
			const removed = await controller.ungateProduct({
				planId: ctx.params.planId,
				productId,
			});
			if (removed) ungated++;
		}

		return { ungated };
	},
);
