import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { SubscriptionController } from "../../service";

export const deletePlan = createAdminEndpoint(
	"/admin/subscriptions/plans/:id/delete",
	{
		method: "DELETE",
		params: z.object({ id: z.string() }),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.subscriptions as SubscriptionController;
		const ok = await controller.deletePlan(ctx.params.id);
		return { ok };
	},
);
