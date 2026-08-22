import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const resumeMembership = createAdminEndpoint(
	"/admin/memberships/:id/resume",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const membership = await controller.resumeMembership(ctx.params.id);
		if (!membership) {
			return { error: "Membership not found", status: 404 };
		}
		void ctx.context.events?.emit("membership.resumed", {
			membershipId: membership.id,
			customerId: membership.customerId,
			planId: membership.planId,
		});
		return { membership };
	},
);
