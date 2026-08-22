import { createStoreEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const listPlans = createStoreEndpoint(
	"/memberships/plans",
	{
		method: "GET",
		query: z.object({
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const plans = await controller.listPlans({
			isActive: true,
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		});

		return { plans };
	},
);
