import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { MembershipController } from "../../service";

export const deletePlan = createAdminEndpoint(
	"/admin/memberships/plans/:id/delete",
	{
		method: "POST",
		params: z.object({ id: z.string().min(1) }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.memberships as MembershipController;

		const deleted = await controller.deletePlan(ctx.params.id);
		if (!deleted) {
			return { error: "Plan not found", status: 404 };
		}

		return { success: true };
	},
);
