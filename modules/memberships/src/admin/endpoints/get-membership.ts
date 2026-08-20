import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { MembershipController } from "../../service";

export const getMembership = createAdminEndpoint(
	"/admin/memberships/:id",
	{
		method: "GET",
		params: z.object({ id: z.string().min(1) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const membership = await controller.getMembership(ctx.params.id);
		if (!membership) {
			return { error: "Membership not found", status: 404 };
		}

		const plan = await controller.getPlan(membership.planId);

		return { membership, plan };
	},
);
