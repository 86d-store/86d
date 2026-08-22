import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const listPlans = createAdminEndpoint(
	"/admin/memberships/plans",
	{
		method: "GET",
		query: z.object({
			active: z.enum(["true", "false"]).optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const params: Parameters<typeof controller.listPlans>[0] = {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.active === "true") params.isActive = true;
		else if (ctx.query.active === "false") params.isActive = false;

		const plans = await controller.listPlans(params);

		const countParams: Parameters<typeof controller.countPlans>[0] = {};
		if (ctx.query.active === "true") countParams.isActive = true;
		else if (ctx.query.active === "false") countParams.isActive = false;
		const total = await controller.countPlans(countParams);

		return { plans, total };
	},
);
