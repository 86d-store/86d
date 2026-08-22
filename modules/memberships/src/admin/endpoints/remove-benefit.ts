import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const removeBenefit = createAdminEndpoint(
	"/admin/memberships/benefits/:id/remove",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const removed = await controller.removeBenefit(ctx.params.id);
		if (!removed) {
			return { error: "Benefit not found", status: 404 };
		}

		return { success: true };
	},
);
