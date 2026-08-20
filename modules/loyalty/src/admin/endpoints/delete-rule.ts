import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { LoyaltyController } from "../../service";

export const deleteRule = createAdminEndpoint(
	"/admin/loyalty/rules/:id/delete",
	{
		method: "DELETE",
		params: z.object({
			id: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.loyalty as LoyaltyController;
		const deleted = await controller.deleteRule(ctx.params.id);
		return { deleted };
	},
);
