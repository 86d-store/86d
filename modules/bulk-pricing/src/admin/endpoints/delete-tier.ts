import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "zod";
import type { BulkPricingController } from "../../service";

export const deleteTier = createAdminEndpoint(
	"/admin/bulk-pricing/tiers/:id/delete",
	{ method: "POST", params: z.object({ id: z.string().max(200) }) },
	async (ctx) => {
		const controller = ctx.context.controllers
			.bulkPricing as BulkPricingController;
		const deleted = await controller.deleteTier(ctx.params.id);
		return { deleted };
	},
);
