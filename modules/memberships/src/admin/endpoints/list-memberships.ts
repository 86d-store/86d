import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const listMemberships = createAdminEndpoint(
	"/admin/memberships",
	{
		method: "GET",
		query: z.object({
			planId: z.string().optional(),
			status: z
				.enum(["active", "trial", "expired", "cancelled", "paused"])
				.optional(),
			take: z.coerce.number().int().min(1).max(100).optional(),
			skip: z.coerce.number().int().min(0).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const params: Parameters<typeof controller.listMemberships>[0] = {
			take: ctx.query.take ?? 50,
			skip: ctx.query.skip ?? 0,
		};
		if (ctx.query.planId != null) params.planId = ctx.query.planId;
		if (ctx.query.status != null) params.status = ctx.query.status;

		const memberships = await controller.listMemberships(params);

		const countParams: Parameters<typeof controller.countMemberships>[0] = {};
		if (ctx.query.planId != null) countParams.planId = ctx.query.planId;
		if (ctx.query.status != null) countParams.status = ctx.query.status;
		const total = await controller.countMemberships(countParams);

		return { memberships, total };
	},
);
