import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerGroupController } from "../../service";

export const removeRule = createAdminEndpoint(
	"/admin/customer-groups/rules/:ruleId/remove",
	{
		method: "POST",
		params: z.object({
			ruleId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		await controller.removeRule(ctx.params.ruleId);

		return { success: true };
	},
);
