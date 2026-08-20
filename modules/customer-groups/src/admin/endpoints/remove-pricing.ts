import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import type { CustomerGroupController } from "../../service";

export const removePricing = createAdminEndpoint(
	"/admin/customer-groups/pricing/:adjustmentId/remove",
	{
		method: "POST",
		params: z.object({
			adjustmentId: z.string(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.customerGroups as CustomerGroupController;

		await controller.removePriceAdjustment(ctx.params.adjustmentId);

		return { success: true };
	},
);
